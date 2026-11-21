package cli_contracts_runtime

import (
	"strconv"
	"strings"
	"unicode/utf8"
)

// Value is a JSON value: nil (null), bool, Number, string, []string, []Value
// or *Object. The program's option values are strings, bools and []string.
type Value = any

// Number is a JSON number, held as the text JavaScript writes for it.
type Number string

// Object is a JSON object that keeps its keys in insertion order, as a
// JavaScript object does.
type Object struct {
	keys   []string
	values map[string]Value
}

// NewObject returns an empty object.
func NewObject() *Object {
	return &Object{values: map[string]Value{}}
}

// Obj builds an object from alternating keys and values.
func Obj(pairs ...Value) *Object {
	o := NewObject()
	for i := 0; i+1 < len(pairs); i += 2 {
		o.Set(pairs[i].(string), pairs[i+1])
	}
	return o
}

// Set sets a key. A key already set keeps its position.
func (o *Object) Set(key string, value Value) {
	if _, ok := o.values[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.values[key] = value
}

// Get returns a key's value.
func (o *Object) Get(key string) (Value, bool) {
	if o == nil {
		return nil, false
	}
	v, ok := o.values[key]
	return v, ok
}

// Has reports whether the key is set.
func (o *Object) Has(key string) bool {
	_, ok := o.Get(key)
	return ok
}

// Keys returns the keys in insertion order.
func (o *Object) Keys() []string {
	if o == nil {
		return nil
	}
	return append([]string(nil), o.keys...)
}

// Len returns the number of keys.
func (o *Object) Len() int {
	if o == nil {
		return 0
	}
	return len(o.keys)
}

// Assign sets every key of src in order, as Object.assign does.
func (o *Object) Assign(src *Object) {
	for _, k := range src.Keys() {
		v, _ := src.Get(k)
		o.Set(k, v)
	}
}

// String returns the value of a string option, nil when it is not set.
func (o *Object) String(key string) *string {
	if v, ok := o.Get(key); ok {
		if s, ok := v.(string); ok {
			return &s
		}
	}
	return nil
}

// Bool returns the value of a boolean option, nil when it is not set.
func (o *Object) Bool(key string) *bool {
	if v, ok := o.Get(key); ok {
		if b, ok := v.(bool); ok {
			return &b
		}
	}
	return nil
}

// Strings returns the values of a repeatable option, nil when it is not set.
func (o *Object) Strings(key string) []string {
	if v, ok := o.Get(key); ok {
		if s, ok := v.([]string); ok {
			return append([]string(nil), s...)
		}
	}
	return nil
}

// Stringify writes a value as JSON.stringify(value, null, indent) does; an
// indent of 0 writes it on one line.
func Stringify(v Value, indent int) string {
	var b strings.Builder
	writeValue(&b, v, indent, 0)
	return b.String()
}

func writeValue(b *strings.Builder, v Value, indent, depth int) {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		if x {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case Number:
		b.WriteString(string(x))
	case int:
		b.WriteString(strconv.Itoa(x))
	case string:
		b.WriteString(Quote(x))
	case []string:
		items := make([]Value, len(x))
		for i, s := range x {
			items[i] = s
		}
		writeArray(b, items, indent, depth)
	case []Value:
		writeArray(b, x, indent, depth)
	case *Object:
		writeObject(b, x, indent, depth)
	default:
		panic("cli_contracts_runtime: not a JSON value")
	}
}

func newline(b *strings.Builder, indent, depth int) {
	if indent > 0 {
		b.WriteByte('\n')
		b.WriteString(strings.Repeat(" ", indent*depth))
	}
}

func writeArray(b *strings.Builder, items []Value, indent, depth int) {
	if len(items) == 0 {
		b.WriteString("[]")
		return
	}
	b.WriteByte('[')
	for i, item := range items {
		if i > 0 {
			b.WriteByte(',')
		}
		newline(b, indent, depth+1)
		writeValue(b, item, indent, depth+1)
	}
	newline(b, indent, depth)
	b.WriteByte(']')
}

func writeObject(b *strings.Builder, o *Object, indent, depth int) {
	if o.Len() == 0 {
		b.WriteString("{}")
		return
	}
	b.WriteByte('{')
	for i, k := range o.keys {
		if i > 0 {
			b.WriteByte(',')
		}
		newline(b, indent, depth+1)
		b.WriteString(Quote(k))
		b.WriteByte(':')
		if indent > 0 {
			b.WriteByte(' ')
		}
		writeValue(b, o.values[k], indent, depth+1)
	}
	newline(b, indent, depth)
	b.WriteByte('}')
}

const hexDigits = "0123456789abcdef"

// Quote writes a string as JSON.stringify does.
func Quote(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for i := 0; i < len(s); {
		r, size := utf8.DecodeRuneInString(s[i:])
		i += size
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				b.WriteString(`\u00`)
				b.WriteByte(hexDigits[r>>4])
				b.WriteByte(hexDigits[r&0xf])
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}
