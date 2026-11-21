//! JSON values that keep their keys in insertion order, as a JavaScript object
//! does, and a writer that writes them as `JSON.stringify` does.

/// A JSON value. The program's option values are strings, booleans and arrays
/// of strings.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    /// A number, held as the text JavaScript writes for it.
    Number(String),
    String(String),
    Array(Vec<Value>),
    Object(Object),
}

/// A JSON object that keeps its keys in insertion order.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Object {
    entries: Vec<(String, Value)>,
}

impl Object {
    /// An empty object.
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets a key. A key already set keeps its position.
    pub fn set(&mut self, key: &str, value: Value) {
        if let Some(entry) = self.entries.iter_mut().find(|(k, _)| k == key) {
            entry.1 = value;
        } else {
            self.entries.push((key.to_string(), value));
        }
    }

    /// A key's value.
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.entries.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }

    /// The keys in insertion order.
    pub fn keys(&self) -> impl Iterator<Item = &str> {
        self.entries.iter().map(|(k, _)| k.as_str())
    }

    /// The entries in insertion order.
    pub fn entries(&self) -> &[(String, Value)] {
        &self.entries
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Sets every key of `src` in order, as `Object.assign` does.
    pub fn assign(&mut self, src: &Object) {
        for (k, v) in &src.entries {
            self.set(k, v.clone());
        }
    }

    /// The value of a string option, `None` when it is not set.
    pub fn string(&self, key: &str) -> Option<String> {
        match self.get(key) {
            Some(Value::String(s)) => Some(s.clone()),
            _ => None,
        }
    }

    /// The value of a boolean option, `None` when it is not set.
    pub fn boolean(&self, key: &str) -> Option<bool> {
        match self.get(key) {
            Some(Value::Bool(b)) => Some(*b),
            _ => None,
        }
    }

    /// The values of a repeatable option, `None` when it is not set.
    pub fn strings(&self, key: &str) -> Option<Vec<String>> {
        match self.get(key) {
            Some(Value::Array(items)) => Some(
                items
                    .iter()
                    .filter_map(|v| match v {
                        Value::String(s) => Some(s.clone()),
                        _ => None,
                    })
                    .collect(),
            ),
            _ => None,
        }
    }
}

impl From<&str> for Value {
    fn from(s: &str) -> Self {
        Value::String(s.to_string())
    }
}

impl From<String> for Value {
    fn from(s: String) -> Self {
        Value::String(s)
    }
}

impl From<bool> for Value {
    fn from(b: bool) -> Self {
        Value::Bool(b)
    }
}

impl From<i32> for Value {
    fn from(n: i32) -> Self {
        Value::Number(n.to_string())
    }
}

impl From<Vec<String>> for Value {
    fn from(items: Vec<String>) -> Self {
        Value::Array(items.into_iter().map(Value::String).collect())
    }
}

impl From<Object> for Value {
    fn from(o: Object) -> Self {
        Value::Object(o)
    }
}

/// An object from its entries, in order.
pub fn obj(entries: Vec<(&str, Value)>) -> Value {
    let mut o = Object::new();
    for (k, v) in entries {
        o.set(k, v);
    }
    Value::Object(o)
}

/// An array.
pub fn arr(items: Vec<Value>) -> Value {
    Value::Array(items)
}

/// A number, as the text JavaScript writes for it.
pub fn num(text: &str) -> Value {
    Value::Number(text.to_string())
}

/// Writes a value as `JSON.stringify(value, null, indent)` does; an indent of
/// 0 writes it on one line.
pub fn stringify(value: &Value, indent: usize) -> String {
    let mut out = String::new();
    write_value(&mut out, value, indent, 0);
    out
}

fn newline(out: &mut String, indent: usize, depth: usize) {
    if indent > 0 {
        out.push('\n');
        out.push_str(&" ".repeat(indent * depth));
    }
}

fn write_value(out: &mut String, value: &Value, indent: usize, depth: usize) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(true) => out.push_str("true"),
        Value::Bool(false) => out.push_str("false"),
        Value::Number(text) => out.push_str(text),
        Value::String(s) => out.push_str(&quote(s)),
        Value::Array(items) => {
            if items.is_empty() {
                out.push_str("[]");
                return;
            }
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                newline(out, indent, depth + 1);
                write_value(out, item, indent, depth + 1);
            }
            newline(out, indent, depth);
            out.push(']');
        }
        Value::Object(o) => {
            if o.is_empty() {
                out.push_str("{}");
                return;
            }
            out.push('{');
            for (i, (k, v)) in o.entries.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                newline(out, indent, depth + 1);
                out.push_str(&quote(k));
                out.push(':');
                if indent > 0 {
                    out.push(' ');
                }
                write_value(out, v, indent, depth + 1);
            }
            newline(out, indent, depth);
            out.push('}');
        }
    }
}

/// A string as `JSON.stringify` writes it.
pub fn quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
