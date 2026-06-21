// S3-backed storage. Issues presigned PUT URLs so clients upload bytes directly
// to object storage, and resolves public URLs (via CloudFront or the bucket).
// Works against real AWS S3 and any S3-compatible store (e.g. MinIO locally).
package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Config configures the S3 storage backend.
type S3Config struct {
	Bucket         string        // target bucket
	Region         string        // AWS region (e.g. ap-south-1)
	Endpoint       string        // optional custom endpoint (MinIO/localstack)
	PublicBaseURL  string        // optional CDN/base URL for public reads (e.g. CloudFront)
	ForcePathStyle bool          // true for MinIO/localstack
	PresignTTL     time.Duration // presigned URL validity
}

// S3 implements Storage against an S3-compatible object store.
type S3 struct {
	client  *s3.Client
	presign *s3.PresignClient
	cfg     S3Config
}

// NewS3 builds an S3 storage backend. Credentials are read from the default
// AWS chain (env vars, shared config, or instance/task role).
func NewS3(ctx context.Context, c S3Config) (*S3, error) {
	if c.PresignTTL == 0 {
		c.PresignTTL = 15 * time.Minute
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(c.Region))
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if c.Endpoint != "" {
			o.BaseEndpoint = aws.String(c.Endpoint)
		}
		o.UsePathStyle = c.ForcePathStyle
	})
	return &S3{
		client:  client,
		presign: s3.NewPresignClient(client),
		cfg:     c,
	}, nil
}

// PresignUpload returns a presigned PUT URL the client uses to upload bytes.
// The client MUST send the same Content-Type when uploading.
func (s *S3) PresignUpload(filename, contentType string) (Presign, error) {
	key := NewKey("products", filename)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	req, err := s.presign.PresignPutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.cfg.Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(s.cfg.PresignTTL))
	if err != nil {
		return Presign{}, fmt.Errorf("presign put: %w", err)
	}
	return Presign{
		Key:       key,
		UploadURL: req.URL,
		PublicURL: s.PublicURL(key),
	}, nil
}

// PublicURL resolves the publicly served URL for a key. Absolute URLs are
// returned unchanged so externally-hosted images keep working.
func (s *S3) PublicURL(key string) string {
	if key == "" {
		return ""
	}
	if isAbsoluteURL(key) {
		return key
	}
	if s.cfg.PublicBaseURL != "" {
		return fmt.Sprintf("%s/%s", strings.TrimRight(s.cfg.PublicBaseURL, "/"), key)
	}
	if s.cfg.Endpoint != "" {
		// Path-style (MinIO/localstack): <endpoint>/<bucket>/<key>
		return fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.cfg.Endpoint, "/"), s.cfg.Bucket, key)
	}
	// Virtual-hosted-style AWS S3 URL.
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.cfg.Bucket, s.cfg.Region, key)
}
