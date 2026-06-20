// Package eventbus abstracts lightweight async eventing between services.
// The current implementation uses Redis Pub/Sub, which is sufficient for the
// initial scale. The Bus interface lets us swap in Kafka or SNS+SQS later
// without touching publishers/subscribers.
package eventbus

import (
	"context"
	"encoding/json"

	"github.com/redis/go-redis/v9"
)

// Event is a generic domain event envelope.
type Event struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Bus publishes and subscribes to domain events.
type Bus interface {
	Publish(ctx context.Context, topic string, eventType string, payload any) error
	Subscribe(ctx context.Context, topic string) (<-chan Event, error)
}

// RedisBus is a Redis Pub/Sub implementation of Bus.
type RedisBus struct {
	rdb *redis.Client
}

// NewRedisBus constructs a Redis-backed event bus.
func NewRedisBus(rdb *redis.Client) *RedisBus { return &RedisBus{rdb: rdb} }

// Publish marshals and publishes an event to a topic.
func (b *RedisBus) Publish(ctx context.Context, topic, eventType string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	data, err := json.Marshal(Event{Type: eventType, Payload: raw})
	if err != nil {
		return err
	}
	return b.rdb.Publish(ctx, topic, data).Err()
}

// Subscribe returns a channel of events for a topic.
func (b *RedisBus) Subscribe(ctx context.Context, topic string) (<-chan Event, error) {
	sub := b.rdb.Subscribe(ctx, topic)
	out := make(chan Event, 16)
	go func() {
		defer close(out)
		ch := sub.Channel()
		for {
			select {
			case <-ctx.Done():
				_ = sub.Close()
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var e Event
				if err := json.Unmarshal([]byte(msg.Payload), &e); err == nil {
					out <- e
				}
			}
		}
	}()
	return out, nil
}
