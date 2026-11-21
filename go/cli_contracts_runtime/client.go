package cli_contracts_runtime

import (
	"bytes"
	"errors"
	"math"
	"os/exec"
	"reflect"
	"strconv"
	"strings"
)

// The command wrappers' side: running a CLI with the arguments a wrapper
// built, and writing a number as an argument the way the TypeScript wrapper's
// String(value) does.

// ExecResult is the outcome of running a CLI.
type ExecResult struct {
	ExitCode int
	Stdout   string
	Stderr   string
}

// Exec runs an executable with arguments. A CLI that cannot be started, or is
// ended by a signal, has exit code 1.
func Exec(executable string, args []string) ExecResult {
	cmd := exec.Command(executable, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	code := 0
	if err != nil {
		code = 1
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && exitErr.ExitCode() >= 0 {
			code = exitErr.ExitCode()
		}
	}
	return ExecResult{ExitCode: code, Stdout: stdout.String(), Stderr: stderr.String()}
}

// FormatInt writes an integer as JavaScript's String(n) does.
func FormatInt(n int64) string {
	return strconv.FormatInt(n, 10)
}

// FormatNumber writes a number as JavaScript's String(n) does
// (Number::toString: the shortest digits that read back as the number, in
// fixed notation from 1e-7 up to 1e21 and exponential notation outside).
func FormatNumber(f float64) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	case f == 0:
		return "0"
	}
	sign := ""
	if f < 0 {
		sign = "-"
		f = -f
	}
	// d.ddde±x: the shortest digits and the exponent.
	e := strconv.FormatFloat(f, 'e', -1, 64)
	mantissa, expText, _ := strings.Cut(e, "e")
	digits := strings.Replace(mantissa, ".", "", 1)
	exp, _ := strconv.Atoi(expText)
	k := len(digits)
	n := exp + 1
	var out string
	switch {
	case k <= n && n <= 21:
		out = digits + strings.Repeat("0", n-k)
	case 0 < n && n <= 21:
		out = digits[:n] + "." + digits[n:]
	case -6 < n && n <= 0:
		out = "0." + strings.Repeat("0", -n) + digits
	default:
		expSign := "+"
		if n-1 < 0 {
			expSign = "-"
		}
		m := digits[:1]
		if k > 1 {
			m += "." + digits[1:]
		}
		out = m + "e" + expSign + strconv.Itoa(abs(n-1))
	}
	return sign + out
}

// ArgString writes a value as an argument the way JavaScript's String(value)
// does: a number in JavaScript's notation, a list as its items joined by
// commas, an object as "[object Object]".
func ArgString(v any) string {
	switch x := v.(type) {
	case nil:
		return "null"
	case string:
		return x
	case bool:
		if x {
			return "true"
		}
		return "false"
	case int:
		return strconv.Itoa(x)
	case int64:
		return FormatInt(x)
	case float64:
		return FormatNumber(x)
	case Number:
		return string(x)
	case *Object, map[string]any:
		return "[object Object]"
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Pointer, reflect.Interface:
		if rv.IsNil() {
			return "null"
		}
		return ArgString(rv.Elem().Interface())
	case reflect.Slice, reflect.Array:
		items := make([]string, rv.Len())
		for i := range items {
			item := rv.Index(i)
			if (item.Kind() == reflect.Pointer || item.Kind() == reflect.Interface) && item.IsNil() {
				continue
			}
			items[i] = ArgString(item.Interface())
		}
		return strings.Join(items, ",")
	case reflect.String:
		return rv.String()
	}
	return "[object Object]"
}
