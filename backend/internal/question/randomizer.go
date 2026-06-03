package question

import "math/rand/v2"

func shuffledQuestions(questions []Question) []Question {
	out := append([]Question(nil), questions...)
	rand.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}

func shuffledOptionKeys() []string {
	out := append([]string(nil), optionKeys...)
	rand.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}
