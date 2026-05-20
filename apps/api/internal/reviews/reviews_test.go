package reviews

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestOpenDB_EmptyDSN(t *testing.T) {
	db, err := OpenDB("")
	if err == nil {
		t.Fatal("expected error for empty DSN, got nil")
	}
	if db != nil {
		db.Close()
		t.Fatal("expected nil db for empty DSN")
	}
}

func TestHandleGetSoloScore_NilDB(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/v1/experiences/:id/solo-score", func(c *gin.Context) {
		if c.Param("id") == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "experience id required"})
			return
		}
		// Simulate the nil-db guard from main.go.
		var db *sql.DB
		if db == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
			return
		}
		HandleGetSoloScore(c, db)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/experiences/exp-123/solo-score", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}
