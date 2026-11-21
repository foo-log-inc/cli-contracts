package cli_contracts_runtime

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

// The policy derivation of `--introspect`. The derivation is defined by
// cli-contracts src/policy-runtime.ts (introspectCommand, derivePolicy,
// isOptionActive); this is its port, and test/conformance compares the two.
// A definition is the command's CommandPolicyDefinition as JSON.

var riskOrder = map[string]int{"low": 0, "medium": 1, "high": 2, "critical": 3}

// isTruthy is JavaScript's truthiness of a JSON value; absent is falsy.
func isTruthy(v Value, ok bool) bool {
	if !ok {
		return false
	}
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case Number:
		return x != "0" && x != "-0" && x != "NaN"
	default:
		return true
	}
}

func get(o Value, key string) (Value, bool) {
	if obj, ok := o.(*Object); ok {
		return obj.Get(key)
	}
	return nil, false
}

// orDefault is `value ?? fallback`.
func orDefault(v Value, ok bool, fallback Value) Value {
	if !ok || v == nil {
		return fallback
	}
	return v
}

func list(v Value, ok bool) []Value {
	if !ok {
		return nil
	}
	switch x := v.(type) {
	case []Value:
		return x
	case []string:
		out := make([]Value, len(x))
		for i, s := range x {
			out[i] = s
		}
		return out
	}
	return nil
}

func riskOf(v Value) (int, bool) {
	s, ok := v.(string)
	if !ok {
		return 0, false
	}
	n, ok := riskOrder[s]
	return n, ok
}

// sourceRequiresConfirmation: the source's explicit requires_confirmation,
// or else its own risk level at high or above.
func sourceRequiresConfirmation(effects Value) bool {
	if v, ok := get(effects, "requires_confirmation"); ok && v != nil {
		return isTruthy(v, true)
	}
	n, ok := riskOf(orDefault2(get(effects, "risk_level")))
	return ok && n >= riskOrder["high"]
}

func orDefault2(v Value, ok bool) Value {
	return orDefault(v, ok, "low")
}

// camelCase joins the `-`-separated words of a name in camelCase, as
// commander keys an option's value.
func camelCase(name string) string {
	words := strings.Split(name, "-")
	for i := 1; i < len(words); i++ {
		w := words[i]
		if w == "" {
			continue
		}
		r, size := utf8.DecodeRuneInString(w)
		words[i] = string(unicode.ToUpper(r)) + w[size:]
	}
	return strings.Join(words, "")
}

func isOptionActive(definition Value, value Value, specified bool) bool {
	schemaType, _ := get(orNil(get(definition, "schema")), "type")
	if schemaType == "boolean" {
		return value == true
	}
	if isTruthy(get(definition, "repeatable")) {
		l, isList := value.([]string)
		return specified && isList && len(l) > 0
	}
	return specified && value != nil
}

func orNil(v Value, _ bool) Value { return v }

func semanticRead(r Value, source string) *Object {
	read := r
	if s, ok := r.(string); ok {
		read = Obj("target", s)
	}
	out := NewObject()
	out.Set("kind", "semantic")
	setIfDefined(out, "target", read)
	setIfDefined(out, "description", read)
	out.Set("source", source)
	return out
}

func setIfDefined(out *Object, key string, from Value) {
	if v, ok := get(from, key); ok {
		out.Set(key, v)
	}
}

func semanticWrite(w Value, source string) *Object {
	write := w
	if s, ok := w.(string); ok {
		write = Obj("target", s)
	}
	out := NewObject()
	out.Set("kind", "semantic")
	setIfDefined(out, "target", write)
	setIfDefined(out, "description", write)
	setIfDefined(out, "overwrite", write)
	setIfDefined(out, "destructive", write)
	setIfDefined(out, "idempotent", write)
	if v, ok := get(write, "idempotency_key"); isTruthy(v, ok) {
		out.Set("idempotency_key", v)
	}
	if v, ok := get(write, "idempotent_note"); isTruthy(v, ok) {
		out.Set("idempotent_note", v)
	}
	out.Set("source", source)
	return out
}

func networkEffect(network Value, source string) *Object {
	out := NewObject()
	if v, ok := get(network, "description"); isTruthy(v, ok) {
		out.Set("description", v)
	}
	if v, ok := get(network, "domains"); isTruthy(v, ok) {
		out.Set("domains", list(v, ok))
	}
	if v, ok := get(network, "idempotent"); ok {
		out.Set("idempotent", v)
	}
	if v, ok := get(network, "idempotency_key"); isTruthy(v, ok) {
		out.Set("idempotency_key", v)
	}
	if v, ok := get(network, "idempotent_note"); isTruthy(v, ok) {
		out.Set("idempotent_note", v)
	}
	out.Set("source", source)
	return out
}

type optionInput struct {
	definition Value
	value      Value
	specified  bool
}

type derivation struct {
	sideEffects   []string
	reads         []Value
	writes        []Value
	network       []Value
	riskLevels    []Value
	executionMode Value
	confirmation  bool
}

func (d *derivation) addSideEffect(effect string) {
	for _, e := range d.sideEffects {
		if e == effect {
			return
		}
	}
	d.sideEffects = append(d.sideEffects, effect)
}

// Every derived write, and only a write, puts file_write among the side effects.
func (d *derivation) addWrite(write *Object) {
	d.addSideEffect("file_write")
	d.writes = append(d.writes, write)
}

// addEffects adds what one source of effects (the command, or an active option) declares.
func (d *derivation) addEffects(effects Value, source string, isCommand bool) {
	d.riskLevels = append(d.riskLevels, orDefault2(get(effects, "risk_level")))
	if sourceRequiresConfirmation(effects) {
		d.confirmation = true
	}
	if v, ok := get(effects, "writes"); isTruthy(v, ok) {
		for _, w := range list(v, ok) {
			d.addWrite(semanticWrite(w, source))
		}
	}
	if v, ok := get(effects, "reads"); isTruthy(v, ok) {
		for _, r := range list(v, ok) {
			d.reads = append(d.reads, semanticRead(r, source))
		}
	}
	if v, ok := get(effects, "network"); isTruthy(v, ok) {
		d.addSideEffect("network")
		if _, isObject := v.(*Object); isObject {
			d.network = append(d.network, networkEffect(v, source))
		}
	}
	if v, ok := get(effects, "execution_mode"); isTruthy(v, ok) {
		if isCommand || d.executionMode == nil {
			d.executionMode = v
		}
	}
}

func derivePolicy(commandID string, commandEffects Value, hasEffects bool, options *Object, env Value) *Object {
	d := &derivation{sideEffects: []string{}, reads: []Value{}, writes: []Value{}, network: []Value{}}
	if hasEffects {
		d.addEffects(commandEffects, "command:"+commandID, true)
	}

	for _, optName := range options.Keys() {
		raw, _ := options.Get(optName)
		input := raw.(optionInput)
		if !isOptionActive(input.definition, input.value, input.specified) {
			continue
		}
		source := "option:" + optName
		if file, ok := get(input.definition, "file"); isTruthy(file, ok) {
			var path Value
			hasPath := false
			if s, isString := input.value.(string); isString {
				path, hasPath = s, true
			}
			mode, _ := get(file, "mode")
			if mode == "read" || mode == "readWrite" {
				read := Obj("kind", "option-file", "option", optName)
				if hasPath {
					read.Set("path", path)
				}
				read.Set("source", source)
				d.reads = append(d.reads, read)
			}
			if mode == "write" || mode == "append" || mode == "readWrite" {
				write := Obj("kind", "option-file", "option", optName)
				if hasPath {
					write.Set("path", path)
				}
				write.Set("mode", mode)
				write.Set("source", source)
				d.addWrite(write)
			}
		}
		if effects, ok := get(input.definition, "effects"); isTruthy(effects, ok) {
			d.addEffects(effects, source, false)
		}
	}

	finalRisk := Value("low")
	maxOrder := 0
	for _, level := range d.riskLevels {
		if n, ok := riskOf(level); ok && n > maxOrder {
			maxOrder = n
			finalRisk = level
		}
	}

	secrets := []string{}
	if envObj, ok := env.(*Object); ok {
		for _, name := range envObj.Keys() {
			v, _ := envObj.Get(name)
			if s, ok := get(v, "sensitive"); isTruthy(s, ok) {
				secrets = append(secrets, name)
			}
		}
	}

	idempotent := true
	for _, w := range d.writes {
		if kind, _ := get(w, "kind"); kind != "semantic" {
			continue
		}
		if v, _ := get(w, "idempotent"); v != true {
			idempotent = false
		}
	}
	for _, n := range d.network {
		if v, _ := get(n, "idempotent"); v != true {
			idempotent = false
		}
	}

	policy := NewObject()
	policy.Set("risk_level", finalRisk)
	policy.Set("requires_confirmation", d.confirmation)
	policy.Set("idempotent", idempotent)
	policy.Set("side_effects", append([]string{}, d.sideEffects...))
	policy.Set("reads", d.reads)
	policy.Set("writes", d.writes)
	if len(d.network) > 0 {
		policy.Set("network", d.network)
	}
	if isTruthy(d.executionMode, d.executionMode != nil) {
		policy.Set("execution_mode", d.executionMode)
	}
	if len(secrets) > 0 {
		policy.Set("requires_secrets", secrets)
	}
	return policy
}

// Introspect derives a command's policy from the option values the program
// parsed for it (introspectCommand).
func Introspect(commandID string, definition Value, optionValues *Object) *Object {
	options := NewObject()
	active := []string{}
	defs, ok := get(definition, "options")
	for _, opt := range list(defs, ok) {
		nameValue, _ := get(opt, "name")
		name, _ := nameValue.(string)
		key := camelCase(name)
		value, has := optionValues.Get(key)
		specified := has && value != nil
		options.Set(name, optionInput{definition: opt, value: value, specified: specified})
		if isOptionActive(opt, value, specified) {
			active = append(active, name)
		}
	}
	effects, hasEffects := get(definition, "effects")
	env, _ := get(definition, "env")
	result := NewObject()
	result.Set("command", commandID)
	result.Set("active_options", active)
	result.Set("policy", derivePolicy(commandID, effects, isTruthy(effects, hasEffects), options, env))
	return result
}
