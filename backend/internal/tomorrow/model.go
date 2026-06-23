package tomorrow

import (
	"context"
	"errors"
	"net/http"
)

const (
	DefaultUsername          = "dmukhat"
	DefaultProfilePath       = "/intra/astanahub/profile?event=96"
	DefaultEventID           = 96
	succeededStatusText      = "Project succeeded"
	invalidCredentialsErrMsg = "User does not exist or password incorrect"
)

var (
	ErrMissingConfiguration = errors.New("tomorrow configuration is missing")
	ErrLoginFailed          = errors.New("tomorrow login failed")
	ErrProfileFetchFailed   = errors.New("tomorrow profile fetch failed")
	ErrProfileFormatChanged = errors.New("tomorrow profile format changed")
	ErrProjectDiscovery     = errors.New("tomorrow project discovery failed")
)

type Project struct {
	ID          string
	Slug        string
	Name        string
	RepoURL     string
	Status      string
	AuditText   string
	IsSucceeded bool
}

type Session struct {
	JWT     string
	Cookies []*http.Cookie
}

type TomorrowClient interface {
	Login(ctx context.Context, username, password string) (Session, error)
	FetchProfilePage(ctx context.Context, session Session, profileURL string) (string, error)
}

type SucceededProjectClient interface {
	FetchSucceededProjects(ctx context.Context, session Session, username string) ([]Project, error)
}

type ProjectDiscoveryService interface {
	DiscoverSucceededProjects(ctx context.Context, profileURL string) ([]Project, error)
}
