package question

func toQuestion(analysisJobID string, input GeneratedQuestionInput) Question {
	return Question{
		AnalysisJobID:  analysisJobID,
		Question:       input.Question,
		OptionA:        input.Options[OptionA],
		OptionB:        input.Options[OptionB],
		OptionC:        input.Options[OptionC],
		OptionD:        input.Options[OptionD],
		CorrectOption:  normalizeOption(input.CorrectOption),
		Explanation:    input.Explanation,
		Difficulty:     normalizeDifficulty(input.Difficulty),
		SourceFilePath: input.SourceFilePath,
	}
}

func toPublicQuestion(q Question, includeSource bool) PublicQuestionDTO {
	dto := PublicQuestionDTO{ID: q.ID, Question: q.Question, Options: q.Options(), Difficulty: q.Difficulty}
	if includeSource {
		dto.SourceFilePath = q.SourceFilePath
	}
	return dto
}
