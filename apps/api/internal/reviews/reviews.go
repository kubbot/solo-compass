package reviews

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// OpenDB opens a PostgreSQL connection. Returns a non-nil error when the DSN
// is empty or the connection cannot be established.
func OpenDB(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, sql.ErrNoRows // sentinel: no DSN configured
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// HandleGetSoloScore handles GET /v1/experiences/:id/solo-score.
// It queries the reviews table and returns the aggregate solo score.
func HandleGetSoloScore(c *gin.Context, db *sql.DB) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "experience id required"})
		return
	}

	var score float64
	var count int
	row := db.QueryRowContext(c.Request.Context(),
		`SELECT COALESCE(AVG(solo_score), 0), COUNT(*) FROM reviews WHERE experience_id = $1`, id)
	if err := row.Scan(&score, &count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"experienceId": id,
		"soloScore":    score,
		"reviewCount":  count,
	})
}
