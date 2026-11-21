package cli_contracts_runtime

import (
	"sort"
	"strings"
)

// The "(Did you mean ...?)" of an unknown option or command, by the rules of
// commander 14 (lib/suggestSimilar.js). Lengths and characters are JavaScript's
// UTF-16 code units.

const maxDistance = 3

func editDistance(a, b []uint16) int {
	if abs(len(a)-len(b)) > maxDistance {
		return max(len(a), len(b))
	}
	d := make([][]int, len(a)+1)
	for i := range d {
		d[i] = make([]int, len(b)+1)
		d[i][0] = i
	}
	for j := 0; j <= len(b); j++ {
		d[0][j] = j
	}
	for j := 1; j <= len(b); j++ {
		for i := 1; i <= len(a); i++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			d[i][j] = min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost)
			if i > 1 && j > 1 && a[i-1] == b[j-2] && a[i-2] == b[j-1] {
				d[i][j] = min(d[i][j], d[i-2][j-2]+1)
			}
		}
	}
	return d[len(a)][len(b)]
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func suggestSimilar(word string, candidates []string) string {
	if len(candidates) == 0 {
		return ""
	}
	seen := map[string]bool{}
	unique := []string{}
	for _, c := range candidates {
		if !seen[c] {
			seen[c] = true
			unique = append(unique, c)
		}
	}
	searchingOptions := strings.HasPrefix(word, "--")
	if searchingOptions {
		word = word[2:]
		for i, c := range unique {
			unique[i] = c[2:]
		}
	}
	w := toUTF16(word)
	similar := []string{}
	bestDistance := maxDistance
	const minSimilarity = 0.4
	for _, candidate := range unique {
		c := toUTF16(candidate)
		if len(c) <= 1 {
			continue
		}
		distance := editDistance(w, c)
		length := max(len(w), len(c))
		similarity := float64(length-distance) / float64(length)
		if similarity > minSimilarity {
			if distance < bestDistance {
				bestDistance = distance
				similar = []string{candidate}
			} else if distance == bestDistance {
				similar = append(similar, candidate)
			}
		}
	}
	sort.SliceStable(similar, func(i, j int) bool { return localeCompare(similar[i], similar[j]) < 0 })
	if searchingOptions {
		for i, c := range similar {
			similar[i] = "--" + c
		}
	}
	switch {
	case len(similar) > 1:
		return "\n(Did you mean one of " + strings.Join(similar, ", ") + "?)"
	case len(similar) == 1:
		return "\n(Did you mean " + similar[0] + "?)"
	}
	return ""
}

// collationKey orders a character as the root collation String.prototype.localeCompare
// uses does for the characters of option and command names: punctuation
// (`_` before `-`), then digits, then letters alphabetically without regard
// to case; any other character by its code point after them.
func collationKey(c rune) (primary int, upper bool) {
	switch {
	case c == '_':
		return 1, false
	case c == '-':
		return 2, false
	case c < 0x80 && !isDigit(c) && !isLetter(c):
		return 3 + int(c), false
	case isDigit(c):
		return 200 + int(c-'0'), false
	case c >= 'a' && c <= 'z':
		return 300 + int(c-'a'), false
	case c >= 'A' && c <= 'Z':
		return 300 + int(c-'A'), true
	}
	return 1000 + int(c), false
}

func isDigit(c rune) bool  { return c >= '0' && c <= '9' }
func isLetter(c rune) bool { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') }

// localeCompare compares as String.prototype.localeCompare does for the
// characters collationKey orders: first without regard to case, then a
// lowercase letter before its uppercase.
func localeCompare(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	for i := 0; i < len(ra) && i < len(rb); i++ {
		pa, _ := collationKey(ra[i])
		pb, _ := collationKey(rb[i])
		if pa != pb {
			if pa < pb {
				return -1
			}
			return 1
		}
	}
	if len(ra) != len(rb) {
		if len(ra) < len(rb) {
			return -1
		}
		return 1
	}
	for i := range ra {
		_, ua := collationKey(ra[i])
		_, ub := collationKey(rb[i])
		if ua != ub {
			if !ua {
				return -1
			}
			return 1
		}
	}
	return 0
}
