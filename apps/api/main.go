package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/getyak/solo-compass/api/internal/reviews"
)

func main() {
	db, err := reviews.OpenDB(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("warn: database unavailable (%v) — /v1 endpoints will return 503", err)
	}

	r := gin.Default()

	// Health check — always available, no DB dependency.
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// v1 API — requires database.
	v1 := r.Group("/v1")
	{
		v1.GET("/experiences/:id/solo-score", func(c *gin.Context) {
			if db == nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
				return
			}
			reviews.HandleGetSoloScore(c, db)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
