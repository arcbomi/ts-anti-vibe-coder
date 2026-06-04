package authn

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var (
	ErrTokenExpired = errors.New("token expired")
	ErrTokenInvalid = errors.New("token invalid")
)

type Claims struct {
	Subject   string `json:"sub"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Issued    int64  `json:"iat"`
	Expires   int64  `json:"exp"`
}

type Identity struct {
	UserID string
	Email  string
	Name   string
}

// Validator validates JWTs issued by this backend's own auth-service.
// It is not intended to validate Tomorrow School-issued tokens.
type Validator struct {
	secret []byte
	now    func() time.Time
}

type ValidatorOption func(*Validator)

func WithNow(now func() time.Time) ValidatorOption {
	return func(v *Validator) {
		if now != nil {
			v.now = now
		}
	}
}

func NewValidator(secret string, opts ...ValidatorOption) (*Validator, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return nil, fmt.Errorf("jwt secret is required")
	}
	v := &Validator{
		secret: []byte(secret),
		now:    time.Now,
	}
	for _, opt := range opts {
		if opt != nil {
			opt(v)
		}
	}
	return v, nil
}

func (v *Validator) Validate(token string) (Claims, error) {
	if v == nil {
		return Claims{}, fmt.Errorf("validator is nil")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, ErrTokenInvalid
	}

	signed := parts[0] + "." + parts[1]
	expected := signHS256([]byte(signed), v.secret)
	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(actual, expected) {
		return Claims{}, ErrTokenInvalid
	}

	var header struct {
		Algorithm string `json:"alg"`
		Type      string `json:"typ"`
	}
	if err := decodeSegment(parts[0], &header); err != nil {
		return Claims{}, ErrTokenInvalid
	}
	if header.Algorithm != "HS256" || header.Type != "JWT" {
		return Claims{}, ErrTokenInvalid
	}

	var claims Claims
	if err := decodeSegment(parts[1], &claims); err != nil {
		return Claims{}, ErrTokenInvalid
	}
	if strings.TrimSpace(claims.Subject) == "" || claims.Expires == 0 {
		return Claims{}, ErrTokenInvalid
	}
	if v.now().UTC().Unix() >= claims.Expires {
		return Claims{}, ErrTokenExpired
	}
	return claims, nil
}

func BearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return ""
	}
	return strings.TrimSpace(header[len("Bearer "):])
}

func IdentityFromClaims(claims Claims) Identity {
	return Identity{
		UserID: strings.TrimSpace(claims.Subject),
		Email:  strings.TrimSpace(claims.Email),
		Name:   strings.TrimSpace(claims.Name),
	}
}

type identityContextKey struct{}

func WithIdentity(ctx context.Context, identity Identity) context.Context {
	return context.WithValue(ctx, identityContextKey{}, identity)
}

func IdentityFromContext(ctx context.Context) (Identity, bool) {
	identity, ok := ctx.Value(identityContextKey{}).(Identity)
	return identity, ok
}

func signHS256(payload []byte, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(payload)
	return mac.Sum(nil)
}

func decodeSegment(segment string, dest any) error {
	data, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}
