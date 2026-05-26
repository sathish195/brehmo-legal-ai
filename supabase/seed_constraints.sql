-- Firm Constraint Nodes (C-010 to C-019)
INSERT INTO constraints (code, description, rule_detail) VALUES
('C-010', 'Liability Cap', 'Liability must be capped at maximum 2x contract value'),
('C-011', 'Non-solicitation / Non-compete', 'Non-solicitation / non-compete maximum 12 months'),
('C-012', 'IP Clauses', 'IP clauses must carve out pre-existing IP'),
('C-013', 'Dispute Resolution', 'Dispute resolution must include arbitration (not just litigation)'),
('C-014', 'Governing Law', 'Governing law must be India jurisdiction'),
('C-015', 'Confidentiality Term', 'Confidentiality term maximum 3 years'),
('C-016', 'Payment Terms', 'Payment terms must not exceed 60 days'),
('C-017', 'Termination Notice', 'Termination notice minimum 30 days'),
('C-018', 'Indemnification', 'Indemnification must be mutual, not one-sided'),
('C-019', 'Data Protection', 'Data protection must reference DPDP Act 2023 for India contracts')
ON CONFLICT (code) DO NOTHING;
