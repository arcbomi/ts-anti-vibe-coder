package exam

import "testing"

func TestGradeCalculatesIntegerScoreAndPassesAtThreshold(t *testing.T) {
	score, passed := Grade(16, 20, 70)
	if score != 80 {
		t.Fatalf("score = %d, want 80", score)
	}
	if !passed {
		t.Fatal("passed = false, want true")
	}
}

func TestGradeFailsBelowThreshold(t *testing.T) {
	score, passed := Grade(13, 20, 70)
	if score != 65 {
		t.Fatalf("score = %d, want 65", score)
	}
	if passed {
		t.Fatal("passed = true, want false")
	}
}

func TestIsValidOptionAllowsOnlyABCD(t *testing.T) {
	for _, option := range []string{OptionA, OptionB, OptionC, OptionD} {
		if !IsValidOption(option) {
			t.Fatalf("IsValidOption(%q) = false, want true", option)
		}
	}
	for _, option := range []string{"", "E", "a"} {
		if IsValidOption(option) {
			t.Fatalf("IsValidOption(%q) = true, want false", option)
		}
	}
}
