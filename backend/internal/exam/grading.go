package exam

func Grade(correctCount, passingScore int) (int, bool) {
	if correctCount < 0 {
		correctCount = 0
	}
	return correctCount, correctCount >= passingScore
}

func IsValidOption(option string) bool {
	switch option {
	case OptionA, OptionB, OptionC, OptionD:
		return true
	default:
		return false
	}
}
