package reviews

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

const anthropicMessagesURL = "https://api.anthropic.com/v1/messages"
const anthropicModel = "claude-opus-4-7"

// ExtractedScores holds the structured solo-traveler metrics from one review.
type ExtractedScores struct {
	WifiScore     float64 `json:"wifi_score"`
	NoiseScore    float64 `json:"noise_score"`
	SeatingScore  float64 `json:"seating_score"`
	StaffScore    float64 `json:"staff_score"`
	LightingScore float64 `json:"lighting_score"`
	SafetyScore   float64 `json:"safety_score"`
	Summary       string  `json:"summary"`
}

// HTTPDoer abstracts http.Client for testing.
type HTTPDoer interface {
	Do(*http.Request) (*http.Response, error)
}

// Extractor calls the Anthropic Claude API to extract solo metrics from text.
type Extractor struct {
	apiKey string
	client HTTPDoer
	apiURL string
}

// NewExtractor creates an Extractor reading ANTHROPIC_API_KEY from env.
func NewExtractor() *Extractor {
	return &Extractor{
		apiKey: os.Getenv("ANTHROPIC_API_KEY"),
		client: http.DefaultClient,
		apiURL: anthropicMessagesURL,
	}
}

// newExtractorWithClient creates an Extractor with a custom HTTP client (for tests).
func newExtractorWithClient(apiKey string, client HTTPDoer, apiURL string) *Extractor {
	return &Extractor{apiKey: apiKey, client: client, apiURL: apiURL}
}

var extractionPrompt = `You are a solo-travel data extractor. Given a review text, output ONLY a JSON object with these fields (all floats 0-10, higher = better for solo travelers):

{
  "wifi_score": <0-10>,
  "noise_score": <0-10, higher = quieter>,
  "seating_score": <0-10, higher = more solo-friendly seating>,
  "staff_score": <0-10, higher = more welcoming staff>,
  "lighting_score": <0-10, higher = better lighting>,
  "safety_score": <0-10, higher = safer>,
  "summary": "<one sentence summary for solo travelers>"
}

If a dimension is not mentioned, output 5.0. Output ONLY the JSON object, no other text.`

// Extract calls Claude to extract structured scores from rawText.
func (e *Extractor) Extract(ctx context.Context, rawText string) (ExtractedScores, error) {
	if e.apiKey == "" {
		return ExtractedScores{}, fmt.Errorf("extractor: ANTHROPIC_API_KEY not set")
	}

	body := map[string]any{
		"model":      anthropicModel,
		"max_tokens": 256,
		"messages": []map[string]string{
			{"role": "user", "content": extractionPrompt + "\n\nReview:\n" + rawText},
		},
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return ExtractedScores{}, fmt.Errorf("extractor: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return ExtractedScores{}, fmt.Errorf("extractor: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", e.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := e.client.Do(req)
	if err != nil {
		return ExtractedScores{}, fmt.Errorf("extractor: http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ExtractedScores{}, fmt.Errorf("extractor: upstream status %d", resp.StatusCode)
	}

	var apiResp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return ExtractedScores{}, fmt.Errorf("extractor: decode response: %w", err)
	}

	var text string
	for _, c := range apiResp.Content {
		if c.Type == "text" {
			text = c.Text
			break
		}
	}
	if text == "" {
		return ExtractedScores{}, fmt.Errorf("extractor: empty content from API")
	}

	var scores ExtractedScores
	if err := json.Unmarshal([]byte(text), &scores); err != nil {
		return ExtractedScores{}, fmt.Errorf("extractor: parse scores JSON %q: %w", text, err)
	}
	return scores, nil
}
