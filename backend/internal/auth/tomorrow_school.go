package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	sdklogger "backend/pkg/sdk/logger"
)

const tomorrowSchoolInvalidCredentialsMessage = "User does not exist or password incorrect"

type TomorrowSchoolClient struct {
	endpoint        string
	graphQLEndpoint string
	graphQLRole     string
	referrer        string
	xJWTToken       string
	sessionID       string
	httpClient      *http.Client
	log             *slog.Logger
	profileLookup   tomorrowSchoolProfileLookup
}

type TomorrowSchoolClientConfig struct {
	Endpoint        string
	GraphQLEndpoint string
	GraphQLRole     string
	Timeout         time.Duration
	Referrer        string
	XJWTToken       string
	SessionID       string
	HTTPClient      *http.Client
	ProfileLookup   tomorrowSchoolProfileLookup
}

type tomorrowSchoolResponse struct {
	Error       string `json:"error"`
	JWT         string `json:"jwt"`
	Token       string `json:"token"`
	AccessToken string `json:"access_token"`
	User        *struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	} `json:"user"`
}

type tomorrowSchoolJWTClaims struct {
	Subject string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
}

type tomorrowSchoolProfile struct {
	Email     string
	Login     string
	FirstName string
	LastName  string
}

type tomorrowSchoolProfileLookup func(context.Context, string, string) (tomorrowSchoolProfile, error)

func NewTomorrowSchoolClient(cfg TomorrowSchoolClientConfig, log *slog.Logger) *TomorrowSchoolClient {
	if cfg.Timeout <= 0 {
		cfg.Timeout = 10 * time.Second
	}
	if log == nil {
		log = slog.Default()
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: cfg.Timeout}
	}
	return &TomorrowSchoolClient{
		endpoint:        strings.TrimSpace(cfg.Endpoint),
		graphQLEndpoint: strings.TrimSpace(cfg.GraphQLEndpoint),
		graphQLRole:     firstNonEmptyTrimmed(cfg.GraphQLRole, "user"),
		referrer:        strings.TrimSpace(cfg.Referrer),
		xJWTToken:       cfg.XJWTToken,
		sessionID:       cfg.SessionID,
		httpClient:      httpClient,
		log:             log,
		profileLookup:   cfg.ProfileLookup,
	}
}

func (c *TomorrowSchoolClient) Authenticate(ctx context.Context, credential, password string) (ExternalIdentity, error) {
	if c == nil || strings.TrimSpace(c.endpoint) == "" {
		return ExternalIdentity{}, ErrAuthProviderFailed
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, http.NoBody)
	if err != nil {
		return ExternalIdentity{}, fmt.Errorf("%w: %v", ErrAuthProviderFailed, err)
	}
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", basicAuthorization(credential, password))
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")
	req.Header.Set("X-Jwt-Token", c.xJWTToken)
	req.Header.Set("X-Session-Id", c.sessionID)
	if c.referrer != "" {
		req.Header.Set("Referer", c.referrer)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if isTimeoutError(err) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			sdklogger.WithRequestIDField(c.log, ctx).Warn("tomorrow school signin timed out", "credential", credential)
			return ExternalIdentity{}, fmt.Errorf("%w: %v", ErrAuthProviderTimedOut, err)
		}
		sdklogger.WithRequestIDField(c.log, ctx).Error("tomorrow school signin request failed", "credential", credential, "err", err)
		return ExternalIdentity{}, fmt.Errorf("%w: %v", ErrAuthProviderFailed, err)
	}
	defer resp.Body.Close()

	raw, readErr := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if readErr != nil {
		return ExternalIdentity{}, fmt.Errorf("%w: read response: %v", ErrAuthProviderFailed, readErr)
	}

	trimmedRaw := strings.TrimSpace(string(raw))
	var payload tomorrowSchoolResponse
	if len(raw) > 0 && !looksLikeJSONString(trimmedRaw) {
		if err := json.Unmarshal(raw, &payload); err != nil {
			sdklogger.WithRequestIDField(c.log, ctx).Error("tomorrow school signin returned invalid json", "credential", credential, "status", resp.StatusCode)
			return ExternalIdentity{}, fmt.Errorf("%w: invalid response", ErrAuthProviderFailed)
		}
	}

	if resp.StatusCode == http.StatusUnauthorized || strings.TrimSpace(payload.Error) == tomorrowSchoolInvalidCredentialsMessage {
		return ExternalIdentity{}, ErrInvalidCredentials
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		sdklogger.WithRequestIDField(c.log, ctx).Error("tomorrow school signin returned error status", "credential", credential, "status", resp.StatusCode, "error_message", strings.TrimSpace(payload.Error))
		return ExternalIdentity{}, fmt.Errorf("%w: status %d", ErrAuthProviderFailed, resp.StatusCode)
	}

	token := firstNonEmptyString(extractJSONString(trimmedRaw), strings.TrimSpace(payload.JWT), strings.TrimSpace(payload.AccessToken), strings.TrimSpace(payload.Token))
	if token == "" {
		sdklogger.WithRequestIDField(c.log, ctx).Error("tomorrow school signin succeeded without jwt", "credential", credential, "status", resp.StatusCode)
		return ExternalIdentity{}, fmt.Errorf("%w: missing jwt", ErrAuthProviderFailed)
	}

	claims := parseTomorrowSchoolJWTClaims(token)
	profile := c.lookupProfile(ctx, token, claims)
	identity := ExternalIdentity{
		Email:       stableTomorrowSchoolEmail(profile, claims, payload.User, credential),
		Name:        stableTomorrowSchoolName(profile, claims, payload.User, credential),
		FullName:    stableTomorrowSchoolFullName(profile, claims, payload.User),
		FirstName:   stableTomorrowSchoolFirstName(profile, payload.User),
		LastName:    stableTomorrowSchoolLastName(profile, payload.User),
		Username:    stableTomorrowSchoolUsername(profile, payload.User, credential),
		RemoteToken: token,
	}
	return identity, nil
}

func basicAuthorization(email, password string) string {
	encoded := base64.StdEncoding.EncodeToString([]byte(email + ":" + password))
	return "Basic " + encoded
}

func extractTomorrowSchoolName(user *struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
}) string {
	if user == nil {
		return ""
	}
	return firstNonEmptyString(strings.TrimSpace(user.FullName), strings.TrimSpace(user.Name), strings.TrimSpace(user.Username))
}

func extractTomorrowSchoolFullName(user *struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
}) string {
	if user == nil {
		return ""
	}
	return strings.TrimSpace(user.FullName)
}

func extractTomorrowSchoolUsername(user *struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
}) string {
	if user == nil {
		return ""
	}
	return strings.TrimSpace(user.Username)
}

func isTimeoutError(err error) bool {
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func looksLikeJSONString(value string) bool {
	return len(value) >= 2 && strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"")
}

func extractJSONString(value string) string {
	if !looksLikeJSONString(value) {
		return ""
	}
	var token string
	if err := json.Unmarshal([]byte(value), &token); err != nil {
		return ""
	}
	return strings.TrimSpace(token)
}

func parseTomorrowSchoolJWTClaims(token string) tomorrowSchoolJWTClaims {
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return tomorrowSchoolJWTClaims{}
	}

	rawClaims, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return tomorrowSchoolJWTClaims{}
	}

	var claims tomorrowSchoolJWTClaims
	if err := json.Unmarshal(rawClaims, &claims); err != nil {
		return tomorrowSchoolJWTClaims{}
	}
	return claims
}

func (c *TomorrowSchoolClient) lookupProfile(ctx context.Context, token string, claims tomorrowSchoolJWTClaims) tomorrowSchoolProfile {
	if c == nil {
		return tomorrowSchoolProfile{}
	}
	lookup := c.profileLookup
	if lookup == nil && c.graphQLEndpoint != "" {
		lookup = c.fetchProfileOverGraphQL
	}
	if lookup == nil {
		return tomorrowSchoolProfile{}
	}
	subject := strings.TrimSpace(claims.Subject)
	if subject == "" {
		return tomorrowSchoolProfile{}
	}
	profile, err := lookup(ctx, token, subject)
	if err != nil {
		sdklogger.WithRequestIDField(c.log, ctx).Warn("tomorrow school profile lookup failed", "subject", subject, "err", err)
		return tomorrowSchoolProfile{}
	}
	return profile
}

func stableTomorrowSchoolEmail(
	profile tomorrowSchoolProfile,
	claims tomorrowSchoolJWTClaims,
	user *struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	},
	credential string,
) string {
	if email := firstNonEmptyString(profile.Email, extractTomorrowSchoolEmail(user), claims.Email); email != "" {
		return email
	}
	if subject := strings.TrimSpace(claims.Subject); subject != "" {
		return "tomorrow-school-" + subject + "@tomorrow-school.local"
	}
	if strings.Contains(strings.TrimSpace(credential), "@") {
		return strings.TrimSpace(credential)
	}
	return ""
}

func stableTomorrowSchoolName(
	profile tomorrowSchoolProfile,
	claims tomorrowSchoolJWTClaims,
	user *struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	},
	credential string,
) string {
	return firstNonEmptyString(
		displayNameFromParts(profile.FirstName, profile.LastName),
		extractTomorrowSchoolName(user),
		claims.Name,
		strings.TrimSpace(credential),
	)
}

func stableTomorrowSchoolFullName(
	profile tomorrowSchoolProfile,
	claims tomorrowSchoolJWTClaims,
	user *struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	},
) string {
	return firstNonEmptyString(displayNameFromParts(profile.FirstName, profile.LastName), extractTomorrowSchoolFullName(user), strings.TrimSpace(claims.Name))
}

func stableTomorrowSchoolUsername(
	profile tomorrowSchoolProfile,
	user *struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	},
	credential string,
) string {
	username := firstNonEmptyString(profile.Login, extractTomorrowSchoolUsername(user))
	if username != "" {
		return username
	}
	credential = strings.TrimSpace(credential)
	if credential != "" && !strings.Contains(credential, "@") {
		return credential
	}
	return ""
}

func stableTomorrowSchoolFirstName(
	profile tomorrowSchoolProfile,
	user *struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	},
) string {
	firstName, _ := normalizedNameParts(profile.FirstName, profile.LastName, firstNonEmptyString(extractTomorrowSchoolFullName(user), extractTomorrowSchoolName(user)))
	return firstName
}

func stableTomorrowSchoolLastName(
	profile tomorrowSchoolProfile,
	user *struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		Username string `json:"username"`
	},
) string {
	_, lastName := normalizedNameParts(profile.FirstName, profile.LastName, firstNonEmptyString(extractTomorrowSchoolFullName(user), extractTomorrowSchoolName(user)))
	return lastName
}

func extractTomorrowSchoolEmail(user *struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Username string `json:"username"`
}) string {
	if user == nil {
		return ""
	}
	return strings.TrimSpace(user.Email)
}

func displayNameFromParts(firstName, lastName string) string {
	firstName = firstNonEmptyTrimmed(firstName)
	lastName = firstNonEmptyTrimmed(lastName)
	switch {
	case firstName != "" && lastName != "":
		return firstName + " " + lastName
	case firstName != "":
		return firstName
	default:
		return lastName
	}
}
