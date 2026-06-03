package exam

func Grade(correctCount, totalQuestions, passingScore int) (int, bool) {
	if totalQuestions <= 0 {
		return 0, false
	}
	score := correctCount * 100 / totalQuestions
	return score, score >= passingScore
}

func IsValidOption(option string) bool {
	switch option {
	case OptionA, OptionB, OptionC, OptionD:
		return true
	default:
		return false
	}
}
