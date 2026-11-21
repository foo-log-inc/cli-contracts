//! The policy derivation of `--introspect`. The derivation is defined by
//! cli-contracts `src/policy-runtime.ts` (introspectCommand, derivePolicy,
//! isOptionActive); this is its port, and test/conformance compares the two.
//! A definition is the command's CommandPolicyDefinition as JSON.

use crate::json::{Object, Value};

fn risk_order(level: &Value) -> Option<u32> {
    match level {
        Value::String(s) => match s.as_str() {
            "low" => Some(0),
            "medium" => Some(1),
            "high" => Some(2),
            "critical" => Some(3),
            _ => None,
        },
        _ => None,
    }
}

/// JavaScript's truthiness of a JSON value; absent is falsy.
fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => !s.is_empty(),
        Some(Value::Number(n)) => !matches!(n.as_str(), "0" | "-0" | "NaN"),
        Some(_) => true,
    }
}

fn get<'v>(v: &'v Value, key: &str) -> Option<&'v Value> {
    match v {
        Value::Object(o) => o.get(key),
        _ => None,
    }
}

/// `value ?? "low"` of a risk level.
fn risk_level(effects: &Value) -> Value {
    match get(effects, "risk_level") {
        None | Some(Value::Null) => Value::from("low"),
        Some(v) => v.clone(),
    }
}

fn items(v: Option<&Value>) -> Vec<Value> {
    match v {
        Some(Value::Array(items)) => items.clone(),
        _ => Vec::new(),
    }
}

/// The source's explicit requires_confirmation, or else its own risk level at
/// high or above.
fn source_requires_confirmation(effects: &Value) -> bool {
    match get(effects, "requires_confirmation") {
        Some(v) if *v != Value::Null => truthy(Some(v)),
        _ => risk_order(&risk_level(effects)).is_some_and(|n| n >= 2),
    }
}

/// Joins the `-`-separated words of a name in camelCase, as commander keys an
/// option's value.
pub(crate) fn camel_case(name: &str) -> String {
    let mut out = String::new();
    for (i, word) in name.split('-').enumerate() {
        if i == 0 {
            out.push_str(word);
            continue;
        }
        let mut chars = word.chars();
        if let Some(first) = chars.next() {
            out.extend(first.to_uppercase());
            out.push_str(chars.as_str());
        }
    }
    out
}

fn is_option_active(definition: &Value, value: Option<&Value>, specified: bool) -> bool {
    let schema_type = get(definition, "schema").and_then(|s| get(s, "type"));
    if schema_type == Some(&Value::from("boolean")) {
        return value == Some(&Value::Bool(true));
    }
    if truthy(get(definition, "repeatable")) {
        return specified && matches!(value, Some(Value::Array(items)) if !items.is_empty());
    }
    specified && !matches!(value, None | Some(Value::Null))
}

fn copy(out: &mut Object, key: &str, from: &Value) {
    if let Some(v) = get(from, key) {
        out.set(key, v.clone());
    }
}

fn copy_if_truthy(out: &mut Object, key: &str, from: &Value) {
    if let Some(v) = get(from, key) {
        if truthy(Some(v)) {
            out.set(key, v.clone());
        }
    }
}

fn as_target(v: &Value) -> Value {
    match v {
        Value::String(s) => crate::json::obj(vec![("target", Value::from(s.as_str()))]),
        other => other.clone(),
    }
}

fn semantic_read(r: &Value, source: &str) -> Value {
    let read = as_target(r);
    let mut out = Object::new();
    out.set("kind", Value::from("semantic"));
    copy(&mut out, "target", &read);
    copy(&mut out, "description", &read);
    out.set("source", Value::from(source));
    Value::Object(out)
}

fn semantic_write(w: &Value, source: &str) -> Value {
    let write = as_target(w);
    let mut out = Object::new();
    out.set("kind", Value::from("semantic"));
    for key in [
        "target",
        "description",
        "overwrite",
        "destructive",
        "idempotent",
    ] {
        copy(&mut out, key, &write);
    }
    copy_if_truthy(&mut out, "idempotency_key", &write);
    copy_if_truthy(&mut out, "idempotent_note", &write);
    out.set("source", Value::from(source));
    Value::Object(out)
}

fn network_effect(network: &Value, source: &str) -> Value {
    let mut out = Object::new();
    copy_if_truthy(&mut out, "description", network);
    copy_if_truthy(&mut out, "domains", network);
    copy(&mut out, "idempotent", network);
    copy_if_truthy(&mut out, "idempotency_key", network);
    copy_if_truthy(&mut out, "idempotent_note", network);
    out.set("source", Value::from(source));
    Value::Object(out)
}

#[derive(Default)]
struct Derivation {
    side_effects: Vec<&'static str>,
    reads: Vec<Value>,
    writes: Vec<Value>,
    network: Vec<Value>,
    risk_levels: Vec<Value>,
    execution_mode: Option<Value>,
    confirmation: bool,
}

impl Derivation {
    fn add_side_effect(&mut self, effect: &'static str) {
        if !self.side_effects.contains(&effect) {
            self.side_effects.push(effect);
        }
    }

    /// Every derived write, and only a write, puts file_write among the side effects.
    fn add_write(&mut self, write: Value) {
        self.add_side_effect("file_write");
        self.writes.push(write);
    }

    /// Adds what one source of effects (the command, or an active option) declares.
    fn add_effects(&mut self, effects: &Value, source: &str, is_command: bool) {
        self.risk_levels.push(risk_level(effects));
        if source_requires_confirmation(effects) {
            self.confirmation = true;
        }
        if truthy(get(effects, "writes")) {
            for w in items(get(effects, "writes")) {
                self.add_write(semantic_write(&w, source));
            }
        }
        if truthy(get(effects, "reads")) {
            for r in items(get(effects, "reads")) {
                self.reads.push(semantic_read(&r, source));
            }
        }
        if let Some(network) = get(effects, "network") {
            if truthy(Some(network)) {
                self.add_side_effect("network");
                if matches!(network, Value::Object(_)) {
                    self.network.push(network_effect(network, source));
                }
            }
        }
        if let Some(mode) = get(effects, "execution_mode") {
            if truthy(Some(mode)) && (is_command || self.execution_mode.is_none()) {
                self.execution_mode = Some(mode.clone());
            }
        }
    }
}

struct OptionInput {
    name: String,
    definition: Value,
    value: Option<Value>,
    specified: bool,
}

fn derive_policy(command_id: &str, definition: &Value, options: &[OptionInput]) -> Value {
    let mut d = Derivation::default();
    if let Some(effects) = get(definition, "effects") {
        if truthy(Some(effects)) {
            d.add_effects(effects, &format!("command:{command_id}"), true);
        }
    }

    for input in options {
        if !is_option_active(&input.definition, input.value.as_ref(), input.specified) {
            continue;
        }
        let source = format!("option:{}", input.name);
        if let Some(file) = get(&input.definition, "file") {
            if truthy(Some(file)) {
                let path = match &input.value {
                    Some(Value::String(s)) => Some(s.clone()),
                    _ => None,
                };
                let mode = get(file, "mode").cloned().unwrap_or(Value::Null);
                let is = |m: &str| mode == Value::from(m);
                if is("read") || is("readWrite") {
                    let mut read = Object::new();
                    read.set("kind", Value::from("option-file"));
                    read.set("option", Value::from(input.name.as_str()));
                    if let Some(p) = &path {
                        read.set("path", Value::from(p.as_str()));
                    }
                    read.set("source", Value::from(source.as_str()));
                    d.reads.push(Value::Object(read));
                }
                if is("write") || is("append") || is("readWrite") {
                    let mut write = Object::new();
                    write.set("kind", Value::from("option-file"));
                    write.set("option", Value::from(input.name.as_str()));
                    if let Some(p) = &path {
                        write.set("path", Value::from(p.as_str()));
                    }
                    write.set("mode", mode.clone());
                    write.set("source", Value::from(source.as_str()));
                    d.add_write(Value::Object(write));
                }
            }
        }
        if let Some(effects) = get(&input.definition, "effects") {
            if truthy(Some(effects)) {
                d.add_effects(effects, &source, false);
            }
        }
    }

    let mut final_risk = Value::from("low");
    let mut max_order = 0;
    for level in &d.risk_levels {
        if let Some(n) = risk_order(level) {
            if n > max_order {
                max_order = n;
                final_risk = level.clone();
            }
        }
    }

    let mut secrets: Vec<Value> = Vec::new();
    if let Some(Value::Object(env)) = get(definition, "env") {
        for (name, var) in env.entries() {
            if truthy(get(var, "sensitive")) {
                secrets.push(Value::from(name.as_str()));
            }
        }
    }

    let idempotent = d
        .writes
        .iter()
        .filter(|w| get(w, "kind") == Some(&Value::from("semantic")))
        .all(|w| get(w, "idempotent") == Some(&Value::Bool(true)))
        && d.network
            .iter()
            .all(|n| get(n, "idempotent") == Some(&Value::Bool(true)));

    let mut policy = Object::new();
    policy.set("risk_level", final_risk);
    policy.set("requires_confirmation", Value::Bool(d.confirmation));
    policy.set("idempotent", Value::Bool(idempotent));
    policy.set(
        "side_effects",
        Value::Array(d.side_effects.iter().map(|s| Value::from(*s)).collect()),
    );
    policy.set("reads", Value::Array(d.reads));
    policy.set("writes", Value::Array(d.writes));
    if !d.network.is_empty() {
        policy.set("network", Value::Array(d.network));
    }
    if let Some(mode) = d.execution_mode {
        policy.set("execution_mode", mode);
    }
    if !secrets.is_empty() {
        policy.set("requires_secrets", Value::Array(secrets));
    }
    Value::Object(policy)
}

/// Derives a command's policy from the option values the program parsed for
/// it (introspectCommand).
pub fn introspect(command_id: &str, definition: &Value, option_values: &Object) -> Value {
    let mut inputs: Vec<OptionInput> = Vec::new();
    let mut active: Vec<Value> = Vec::new();
    for opt in items(get(definition, "options")) {
        let name = match get(&opt, "name") {
            Some(Value::String(s)) => s.clone(),
            _ => String::new(),
        };
        let value = option_values.get(&camel_case(&name)).cloned();
        let specified = !matches!(value, None | Some(Value::Null));
        if is_option_active(&opt, value.as_ref(), specified) {
            active.push(Value::from(name.as_str()));
        }
        // An option given twice under one name keeps its first place and its last definition.
        let input = OptionInput {
            name: name.clone(),
            definition: opt,
            value,
            specified,
        };
        match inputs.iter_mut().find(|i| i.name == name) {
            Some(existing) => *existing = input,
            None => inputs.push(input),
        }
    }
    let mut result = Object::new();
    result.set("command", Value::from(command_id));
    result.set("active_options", Value::Array(active));
    result.set("policy", derive_policy(command_id, definition, &inputs));
    Value::Object(result)
}
