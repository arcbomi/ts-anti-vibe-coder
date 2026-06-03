package database

import (
  "context"

  "github.com/jackc/pgx/v5"
  "github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
  cfg, err := pgxpool.ParseConfig(dsn)
  if err != nil {
    return nil, err
  }
  pool, err := pgxpool.NewWithConfig(ctx, cfg)
  if err != nil {
    return nil, err
  }
  if err := pool.Ping(ctx); err != nil {
    pool.Close()
    return nil, err
  }
  return pool, nil
}

func WithTx(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) error {
  tx, err := pool.Begin(ctx)
  if err != nil {
    return err
  }
  defer func() { _ = tx.Rollback(ctx) }()
  if err := fn(tx); err != nil {
    return err
  }
  return tx.Commit(ctx)
}
