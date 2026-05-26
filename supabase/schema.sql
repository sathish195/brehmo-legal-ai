-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    raw_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: clauses
CREATE TABLE IF NOT EXISTS clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    clause_number TEXT,
    clause_title TEXT,
    clause_type TEXT,
    full_text TEXT NOT NULL,
    risk_score INTEGER,
    risk_level TEXT, -- GREEN, YELLOW, RED
    position INTEGER NOT NULL,
    word_count INTEGER
);

-- Table: comparisons
CREATE TABLE IF NOT EXISTS comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_v1_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    doc_v2_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    results_json JSONB NOT NULL,
    net_risk_delta TEXT, -- INCREASED, DECREASED, NEUTRAL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: constraints
CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    rule_detail TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE
);
