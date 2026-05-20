package reviews

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"
)

type mockHTTPClient struct {
	status int
	body   string
	err    error
}

func (m *mockHTTPClient) Do(_ *http.Request) (*http.Response, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &http.Response{
		StatusCode: m.status,
		Body:       io.NopCloser(bytes.NewBufferString(m.body)),
	}, nil
}

func TestExtract_SuccessPath(t *testing.T) {
	scoresJSON := `{\"wifi_score\":8.0,\"noise_score\":7.5,\"seating_score\":9.0,\"staff_score\":6.0,\"lighting_score\":7.0,\"safety_score\":8.5,\"summary\":\"Quiet cafe, great for solo work\"}`
	body := `{"content":[{"type":"text","text":"` + scoresJSON + `"}]}`

	ext := newExtractorWithClient("test-key", &mockHTTPClient{
		status: http.StatusOK,
		body:   body,
	}, "https://api.anthropic.com/v1/messages")

	scores, err := ext.Extract(context.Background(), "Great cafe for solo work, free wifi")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if scores.WifiScore != 8.0 {
		t.Errorf("wifi_score: expected 8.0, got %f", scores.WifiScore)
	}
	if scores.SafetyScore != 8.5 {
		t.Errorf("safety_score: expected 8.5, got %f", scores.SafetyScore)
	}
	if scores.Summary == "" {
		t.Error("summary must not be empty")
	}
}

func TestExtract_MissingAPIKey(t *testing.T) {
	ext := newExtractorWithClient("", &mockHTTPClient{}, "https://api.anthropic.com/v1/messages")
	_, err := ext.Extract(context.Background(), "some text")
	if err == nil {
		t.Fatal("expected error for missing API key")
	}
}

func TestExtract_Non200Response(t *testing.T) {
	ext := newExtractorWithClient("test-key", &mockHTTPClient{
		status: http.StatusTooManyRequests,
		body:   `{"error":"rate limited"}`,
	}, "https://api.anthropic.com/v1/messages")

	_, err := ext.Extract(context.Background(), "some text")
	if err == nil {
		t.Fatal("expected error for non-200 status")
	}
}

func TestExtract_MalformedJSON(t *testing.T) {
	body := `{"content":[{"type":"text","text":"not valid json"}]}`
	ext := newExtractorWithClient("test-key", &mockHTTPClient{
		status: http.StatusOK,
		body:   body,
	}, "https://api.anthropic.com/v1/messages")

	_, err := ext.Extract(context.Background(), "some text")
	if err == nil {
		t.Fatal("expected error for malformed JSON in text field")
	}
}

func TestExtract_EmptyContentResponse(t *testing.T) {
	body := `{"content":[]}`
	ext := newExtractorWithClient("test-key", &mockHTTPClient{
		status: http.StatusOK,
		body:   body,
	}, "https://api.anthropic.com/v1/messages")

	_, err := ext.Extract(context.Background(), "some text")
	if err == nil {
		t.Fatal("expected error for empty content")
	}
}
