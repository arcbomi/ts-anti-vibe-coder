package worker

const (
	StatusPending             = "pending"
	StatusCheckingBotAccess   = "checking_bot_access"
	StatusReadingRepository   = "reading_repository"
	StatusIndexingCode        = "indexing_code"
	StatusAnalyzingCode       = "analyzing_code"
	StatusGeneratingQuestions = "generating_questions"
	StatusSavingQuestions     = "saving_questions"
	StatusCompleted           = "completed"
	StatusFailed              = "failed"
)
