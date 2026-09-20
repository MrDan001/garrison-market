create unique index if not exists analytics_snapshots_connection_platform_date_uidx
  on marketing.analytics_snapshots(connection_id, platform, metric_date)
  where connection_id is not null and post_id is null;