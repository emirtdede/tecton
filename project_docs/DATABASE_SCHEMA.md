# Veritabanı Şeması

## Tablolar

### app_settings (Sistem Ayarları - Zero Code Change)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| setting_key  | TEXT          | UNIQUE, NOT NULL       |
| setting_value| TEXT          | NOT NULL (JSON/String) |
| description  | TEXT          |                        |
| updated_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### work_types (Dinamik Çalışma Tipleri)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| name         | TEXT          | NOT NULL (örn: Pazar Mesaisi) |
| multiplier   | REAL          | NOT NULL (örn: 2.0)    |
| is_active    | BOOLEAN       | DEFAULT 1              |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### worker_groups (Dinamik İşçi Grupları)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| name         | TEXT          | NOT NULL (örn: Elektrikçiler) |
| is_active    | BOOLEAN       | DEFAULT 1              |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### workers (İşçi Sicil ve Profilleri)
| Kolon        | Tip           | Özellik          |
|--------------|---------------|------------------|
| id           | INTEGER       | PK, AUTOINCREMENT|
| full_name    | TEXT          | NOT NULL         |
| tc_no        | TEXT          | 11 Haneli (Validasyonlu) |
| phone        | TEXT          |                  |
| daily_wage   | REAL          | NOT NULL         |
| group_id     | INTEGER       | FK → worker_groups.id |
| start_date   | DATE          |                  |
| isg_start_date | DATE        | İSG Başlangıç    |
| isg_bitis_tarihi| DATE       | İSG Bitiş        |
| status       | TEXT          | DEFAULT 'active' |
| extra_data   | TEXT          | JSON (Esnek Metadatalar) |
| project_id   | INTEGER       | FK → projects.id (migrasyonla eklendi) |
| tags         | TEXT          | JSON etiketler (migrasyonla eklendi) |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                  |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### timesheets (Puantaj / Günlük Yevmiye Kayıtları - Mühürleme)
| Kolon              | Tip           | Özellik                |
|--------------------|---------------|------------------------|
| id                 | INTEGER       | PK, AUTOINCREMENT      |
| worker_id          | INTEGER       | FK → workers.id        |
| work_date          | DATE          | NOT NULL               |
| work_type_id       | INTEGER       | FK → work_types.id     |
| applied_wage       | REAL          | NOT NULL (Snapshot)    |
| applied_multiplier | REAL          | NOT NULL (Snapshot)    |
| overtime_hours     | REAL          | DEFAULT 0              |
| earned_amount      | REAL          | NOT NULL (Hesaplanan)  |
| notes              | TEXT          |                        |
| project_id         | INTEGER       | FK → projects.id (migrasyonla eklendi) |
| tags               | TEXT          | JSON etiketler (migrasyonla eklendi) |
| is_deleted         | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at         | TIMESTAMP     |                        |
| created_at         | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### transactions (Personel Cari: Avans, Kesinti ve Ödemeler)
| Kolon          | Tip           | Özellik                |
|----------------|---------------|------------------------|
| id             | INTEGER       | PK, AUTOINCREMENT      |
| worker_id      | INTEGER       | FK → workers.id        |
| trans_date     | DATE          | NOT NULL               |
| trans_type     | TEXT          | 'avans', 'kesinti', 'odeme' |
| amount         | REAL          | NOT NULL               |
| notes          | TEXT          |                        |
| linked_cash_id | INTEGER       | FK → cash_register.id (Otonomi) |
| project_id     | INTEGER       | FK → projects.id (migrasyonla eklendi) |
| tags           | TEXT          | JSON etiketler (migrasyonla eklendi) |
| is_deleted     | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at     | TIMESTAMP     |                        |
| created_at     | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### cash_register (Kasa Hareketleri)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| trans_date   | DATE          | NOT NULL               |
| type         | TEXT          | 'giris', 'cikis'       |
| amount       | REAL          | NOT NULL               |
| description  | TEXT          |                        |
| project_id   | INTEGER       | FK → projects.id (migrasyonla eklendi) |
| tags         | TEXT          | JSON etiketler (migrasyonla eklendi) |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### audit_logs (İşlem Günlükleri - Güvenlik Katmanı)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| table_name   | TEXT          | Hangi tabloda işlem yapıldı |
| record_id    | INTEGER       | İşlem gören kaydın ID'si |
| action       | TEXT          | 'CREATE', 'UPDATE', 'DELETE' |
| old_values   | TEXT          | JSON (Eski değerler)   |
| new_values   | TEXT          | JSON (Yeni değerler)   |
| project_id   | INTEGER       | FK → projects.id (migrasyonla eklendi) |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### subcontractor_ledgers (Taşeron ve Alt Yüklenici Cari)
| Kolon          | Tip           | Özellik                |
|----------------|---------------|------------------------|
| id             | INTEGER       | PK, AUTOINCREMENT      |
| project_id     | INTEGER       | FK → projects.id       |
| name           | TEXT          | NOT NULL               |
| service_type   | TEXT          | NOT NULL               |
| phone          | TEXT          |                        |
| daily_wage     | REAL          | NOT NULL               |
| status         | TEXT          | DEFAULT 'active'       |
| isg_start_date | DATE          | İSG Başlangıç          |
| isg_expiry_date| DATE          | İSG Bitiş              |
| is_deleted     | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at     | TIMESTAMP     |                        |
| created_at     | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### projects (Şantiye Yönetimi)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| name         | TEXT          | NOT NULL               |
| location     | TEXT          |                        |
| status       | TEXT          | DEFAULT 'active'       |
| sort_order   | INTEGER       | DEFAULT 0              |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### production_records (İmalat Kayıtları)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| project_id   | INTEGER       | FK → projects.id       |
| item_name    | TEXT          | NOT NULL               |
| quantity     | REAL          | NOT NULL               |
| unit         | TEXT          | NOT NULL               |
| notes        | TEXT          |                        |
| record_date  | DATE          | NOT NULL               |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### materials (Malzeme ve İrsaliye Kayıtları)
| Kolon          | Tip           | Özellik                |
|----------------|---------------|------------------------|
| id             | INTEGER       | PK, AUTOINCREMENT      |
| project_id     | INTEGER       | FK → projects.id       |
| supplier       | TEXT          | NOT NULL               |
| material_type  | TEXT          | NOT NULL               |
| quantity       | REAL          | NOT NULL               |
| unit           | TEXT          | NOT NULL               |
| receipt_number | TEXT          |                        |
| receipt_date   | DATE          | NOT NULL               |
| photo_path     | TEXT          | İrsaliye fotoğraf yolu |
| notes          | TEXT          |                        |
| is_deleted     | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at     | TIMESTAMP     |                        |
| created_at     | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### daily_journals (Şantiye Günlük Jurnal)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| project_id   | INTEGER       | FK → projects.id       |
| journal_date | DATE          | UNIQUE (project_id ile), NOT NULL |
| weather_temp | REAL          | Hava sıcaklığı (OpenWeather) |
| weather_desc | TEXT          | Hava durumu açıklaması |
| weather_icon | TEXT          | Hava durumu ikonu      |
| notes        | TEXT          |                        |
| worker_count | INTEGER       | O gün çalışan işçi sayısı |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### quality_reports (Kalite Raporları ve Tutanaklar)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| project_id   | INTEGER       | FK → projects.id       |
| title        | TEXT          | NOT NULL               |
| description  | TEXT          |                        |
| status       | TEXT          | DEFAULT 'open'         |
| photo_path   | TEXT          | Tutanak/Hata fotoğrafı |
| report_date  | DATE          | NOT NULL               |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### subcontractor_transactions (Taşeron İşlemleri)
| Kolon            | Tip           | Özellik                |
|------------------|---------------|------------------------|
| id               | INTEGER       | PK, AUTOINCREMENT      |
| subcontractor_id | INTEGER       | FK → subcontractor_ledgers.id |
| trans_date       | DATE          | NOT NULL               |
| type             | TEXT          | NOT NULL (odeme, avans vb.) |
| amount           | REAL          | NOT NULL               |
| description      | TEXT          |                        |
| project_id       | INTEGER       | FK → projects.id       |
| linked_cash_id   | INTEGER       | FK → cash_register.id  |
| is_deleted       | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at       | TIMESTAMP     |                        |
| created_at       | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

### worker_leaves (Personel İzinleri)
| Kolon        | Tip           | Özellik                |
|--------------|---------------|------------------------|
| id           | INTEGER       | PK, AUTOINCREMENT      |
| worker_id    | INTEGER       | FK → workers.id        |
| project_id   | INTEGER       | FK → projects.id       |
| start_date   | DATE          | NOT NULL               |
| end_date     | DATE          | NOT NULL               |
| type         | TEXT          | NOT NULL (Ücretli, Ücretsiz vb.) |
| description  | TEXT          |                        |
| is_deleted   | BOOLEAN       | DEFAULT 0 (Çöp Kutusu) |
| deleted_at   | TIMESTAMP     |                        |
| created_at   | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP |

## İlişkiler
- projects → workers, timesheets, transactions, cash_register, production_records, materials, daily_journals, quality_reports, subcontractor_ledgers, subcontractor_transactions, worker_leaves, audit_logs (1:N)
- workers → timesheets, transactions, worker_leaves (1:N)
- work_types → timesheets (1:N)
- worker_groups → workers (1:N)
- subcontractor_ledgers → subcontractor_transactions (1:N)
- cash_register ↔ transactions (1:1 Opsiyonel Kasa Otonomisi)
- cash_register ↔ subcontractor_transactions (1:1 Opsiyonel Kasa Otonomisi)

## İndeksler
- workers.group_id (Gruba göre filtreleme ve raporlama için)
- workers.tc_no (TC ile arama için)
- timesheets.worker_id (İşçinin puantajını hızlı getirmek için)
- timesheets.work_date (Tarihe göre yevmiye raporları için)
- transactions.worker_id (İşçinin avans/ödeme geçmişi için)
- transactions.trans_date (Aylık ödeme analizleri için)
- transactions.linked_cash_id (Otonom işlem silme için)
- audit_logs.table_name, audit_logs.record_id (Geçmiş aramaları için)
- projects.id (Şantiye tabanlı tüm raporlamalar için)
- daily_journals (project_id, journal_date) (Aynı şantiyede günde bir jurnal için UNIQUE constraint)