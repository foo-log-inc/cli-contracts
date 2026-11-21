package cli_contracts_runtime

import (
	"io"
	"strings"
	"time"
)

// The built-in extract command. Its output is computed when the program is
// generated (cli-contracts src/generators/runtime-spec.ts, ExtractSpec);
// what depends on the invocation is filled in here: the time, and which
// commands the given IDs select.

// ExtractedAt stands where the time of the invocation goes in the output.
const ExtractedAt = "\x00cli-contracts:extractedAt\x00"

// extractedAtJSON is ExtractedAt as it appears inside a JSON string.
const extractedAtJSON = `\u0000cli-contracts:extractedAt\u0000`

// ExtractCommand is a command of the embedded contract, as JSON at its depth.
type ExtractCommand struct {
	ID   string
	Text string
}

// ExtractSet is a command set of the embedded contract.
type ExtractSet struct {
	ID       string
	Key      string
	Before   []string
	After    []string
	Commands []ExtractCommand
}

// ExtractSpec is the output of the built-in extract command.
type ExtractSpec struct {
	YAMLWithMeta    string
	YAMLWithoutMeta string
	JSONWithMeta    string
	JSONWithoutMeta string
	FilterHead      string
	FilterTail      string
	Sets            []ExtractSet
}

// isoNow is the time as JavaScript's Date.prototype.toISOString writes it.
func isoNow() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

func (r *run) extract(args []Arg, opts *Object) int {
	spec := r.p.Extract
	commands := args[0].Values
	all := truthy(opts.Get("all"))
	if len(commands) == 0 && !all {
		io.WriteString(r.stderr, `{"code":"INVALID_ARGS","message":"Specify command IDs or use --all"}`+"\n")
		return 2
	}
	format := "yaml"
	if v, ok := opts.Get("format"); truthy(v, ok) {
		format, _ = v.(string)
	}
	ids := commands
	if all {
		ids = nil
	}
	includeMeta := truthy(opts.Get("includeMeta"))
	now := isoNow()
	if len(ids) == 0 {
		var out string
		if format == "json" {
			out = spec.JSONWithoutMeta
			if includeMeta {
				out = spec.JSONWithMeta
			}
			out = strings.ReplaceAll(out, extractedAtJSON, now)
		} else {
			out = spec.YAMLWithoutMeta
			if includeMeta {
				out = spec.YAMLWithMeta
			}
			out = strings.ReplaceAll(out, ExtractedAt, now)
		}
		io.WriteString(r.stdout, out)
		return 0
	}

	selected := func(setID, cmdID string) bool {
		for _, id := range ids {
			if id == cmdID || id == setID+"."+cmdID || strings.HasPrefix(cmdID, id+".") {
				return true
			}
		}
		return false
	}
	sets := []string{}
	for _, set := range spec.Sets {
		matched := []string{}
		for _, cmd := range set.Commands {
			if selected(set.ID, cmd.ID) {
				matched = append(matched, cmd.Text)
			}
		}
		if len(matched) == 0 {
			continue
		}
		entries := append([]string{}, set.Before...)
		entries = append(entries, "      \"commands\": {\n"+strings.Join(matched, ",\n")+"\n      }")
		entries = append(entries, set.After...)
		sets = append(sets, set.Key+"{\n"+strings.Join(entries, ",\n")+"\n    }")
	}
	commandSets := "{}"
	if len(sets) > 0 {
		commandSets = "{\n" + strings.Join(sets, ",\n") + "\n  }"
	}
	io.WriteString(r.stdout, spec.FilterHead+commandSets+spec.FilterTail)
	return 0
}

// NewExtractSpec builds the output of the built-in extract command.
func NewExtractSpec(yamlWithMeta, yamlWithoutMeta, jsonWithMeta, jsonWithoutMeta, filterHead, filterTail string, sets ...ExtractSet) *ExtractSpec {
	return &ExtractSpec{
		YAMLWithMeta:    yamlWithMeta,
		YAMLWithoutMeta: yamlWithoutMeta,
		JSONWithMeta:    jsonWithMeta,
		JSONWithoutMeta: jsonWithoutMeta,
		FilterHead:      filterHead,
		FilterTail:      filterTail,
		Sets:            sets,
	}
}

// NewExtractSet builds a command set of the embedded contract; commands alternate IDs and texts.
func NewExtractSet(id, key string, before, after []string, commands ...string) ExtractSet {
	set := ExtractSet{ID: id, Key: key, Before: before, After: after}
	for i := 0; i+1 < len(commands); i += 2 {
		set.Commands = append(set.Commands, ExtractCommand{ID: commands[i], Text: commands[i+1]})
	}
	return set
}
