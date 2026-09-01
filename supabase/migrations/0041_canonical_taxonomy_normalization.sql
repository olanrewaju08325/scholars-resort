-- Migration 0041: Canonical Academic Taxonomy Normalization
-- Safe, additive migration: fixes casing and expands syllabus topics across all 20 subjects.

-- 1. Fix casing defect in subjects table (computer studies -> Computer Studies)
UPDATE subjects
SET name = 'Computer Studies'
WHERE name = 'computer studies' OR id = '27301c5d-9652-4a18-8d77-d104bf8a093a';

-- 2. Ensure all 20 canonical subjects have appropriate icon and active status
UPDATE subjects SET is_active = true WHERE is_active IS NULL OR is_active = false;

-- 3. Seed canonical JAMB/UTME topics for subjects that need syllabus coverage
-- Using DO block to dynamically fetch canonical subject_id without hardcoding replacement UUIDs

DO $$
DECLARE
  v_english_id UUID;
  v_maths_id UUID;
  v_physics_id UUID;
  v_chem_id UUID;
  v_bio_id UUID;
  v_econ_id UUID;
  v_govt_id UUID;
  v_lit_id UUID;
  v_comm_id UUID;
  v_acc_id UUID;
  v_agric_id UUID;
  v_geo_id UUID;
  v_comp_id UUID;
  v_hist_id UUID;
  v_crs_id UUID;
  v_irs_id UUID;
  v_hausa_id UUID;
  v_igbo_id UUID;
  v_yoruba_id UUID;
  v_french_id UUID;
BEGIN
  -- Retrieve canonical IDs
  SELECT id INTO v_english_id FROM subjects WHERE name = 'Use of English' LIMIT 1;
  SELECT id INTO v_maths_id FROM subjects WHERE name = 'Mathematics' LIMIT 1;
  SELECT id INTO v_physics_id FROM subjects WHERE name = 'Physics' LIMIT 1;
  SELECT id INTO v_chem_id FROM subjects WHERE name = 'Chemistry' LIMIT 1;
  SELECT id INTO v_bio_id FROM subjects WHERE name = 'Biology' LIMIT 1;
  SELECT id INTO v_econ_id FROM subjects WHERE name = 'Economics' LIMIT 1;
  SELECT id INTO v_govt_id FROM subjects WHERE name = 'Government' LIMIT 1;
  SELECT id INTO v_lit_id FROM subjects WHERE name = 'Literature in English' LIMIT 1;
  SELECT id INTO v_comm_id FROM subjects WHERE name = 'Commerce' LIMIT 1;
  SELECT id INTO v_acc_id FROM subjects WHERE name = 'Principles of Accounts' LIMIT 1;
  SELECT id INTO v_agric_id FROM subjects WHERE name = 'Agricultural Science' LIMIT 1;
  SELECT id INTO v_geo_id FROM subjects WHERE name = 'Geography' LIMIT 1;
  SELECT id INTO v_comp_id FROM subjects WHERE name = 'Computer Studies' LIMIT 1;
  SELECT id INTO v_hist_id FROM subjects WHERE name = 'History' LIMIT 1;
  SELECT id INTO v_crs_id FROM subjects WHERE name = 'Christian Religious Studies' LIMIT 1;
  SELECT id INTO v_irs_id FROM subjects WHERE name = 'Islamic Religious Studies' LIMIT 1;
  SELECT id INTO v_hausa_id FROM subjects WHERE name = 'Hausa' LIMIT 1;
  SELECT id INTO v_igbo_id FROM subjects WHERE name = 'Igbo' LIMIT 1;
  SELECT id INTO v_yoruba_id FROM subjects WHERE name = 'Yoruba' LIMIT 1;
  SELECT id INTO v_french_id FROM subjects WHERE name = 'French' LIMIT 1;

  -- Biology Topics
  IF v_bio_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_bio_id, 'Living Organisms & Cell Structure'),
      (v_bio_id, 'Nutrition & Digestive Systems'),
      (v_bio_id, 'Transport Systems in Plants & Animals'),
      (v_bio_id, 'Respiration & Gaseous Exchange'),
      (v_bio_id, 'Excretion & Osmoregulation'),
      (v_bio_id, 'Reproduction in Plants & Animals'),
      (v_bio_id, 'Genetics, Heredity & Evolution'),
      (v_bio_id, 'Ecology & Ecosystem Dynamics')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Physics Topics (add missing beyond Mechanics)
  IF v_physics_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_physics_id, 'Thermal Physics & Heat Energy'),
      (v_physics_id, 'Waves, Optics & Sound'),
      (v_physics_id, 'Electricity & Magnetism'),
      (v_physics_id, 'Atomic & Modern Physics'),
      (v_physics_id, 'Scalar & Vector Quantities'),
      (v_physics_id, 'Pressure in Fluids')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mathematics Topics (add missing beyond Algebra, Calculus)
  IF v_maths_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_maths_id, 'Number & Numeration'),
      (v_maths_id, 'Geometry & Trigonometry'),
      (v_maths_id, 'Statistics & Probability'),
      (v_maths_id, 'Matrices & Determinants'),
      (v_maths_id, 'Sets, Logic & Boolean Algebra'),
      (v_maths_id, 'Coordinate Geometry')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Economics Topics
  IF v_econ_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_econ_id, 'Basic Concepts of Economics & Scarcity'),
      (v_econ_id, 'Theory of Demand & Supply'),
      (v_econ_id, 'Theory of Production & Costs'),
      (v_econ_id, 'Market Structures & Price Determination'),
      (v_econ_id, 'National Income Accounting'),
      (v_econ_id, 'Money, Banking & Monetary Policy'),
      (v_econ_id, 'Public Finance & Fiscal Policy'),
      (v_econ_id, 'International Trade & Balance of Payments')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Government Topics
  IF v_govt_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_govt_id, 'Basic Principles of Government'),
      (v_govt_id, 'Organs & Arms of Government'),
      (v_govt_id, 'Constitutions & Constitutionalism'),
      (v_govt_id, 'Political Parties & Electoral Systems'),
      (v_govt_id, 'Pre-Colonial Administration in Nigeria'),
      (v_govt_id, 'Colonial Rule & Nationalism'),
      (v_govt_id, 'Nigerian Constitutional Development'),
      (v_govt_id, 'Nigeria Foreign Policy & International Organizations')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Literature in English Topics
  IF v_lit_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_lit_id, 'Literary Appreciation & Figures of Speech'),
      (v_lit_id, 'African Prose'),
      (v_lit_id, 'Non-African Prose'),
      (v_lit_id, 'African Drama'),
      (v_lit_id, 'Non-African Drama'),
      (v_lit_id, 'African Poetry'),
      (v_lit_id, 'Non-African Poetry'),
      (v_lit_id, 'Prescribed UTME Novel (The Life Changer)')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Commerce Topics
  IF v_comm_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_comm_id, 'Introduction to Commerce & Trade'),
      (v_comm_id, 'Home & Foreign Trade'),
      (v_comm_id, 'Business Organizations'),
      (v_comm_id, 'Banking & Financial Institutions'),
      (v_comm_id, 'Insurance & Risk Management'),
      (v_comm_id, 'Advertising & Sales Promotion')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Principles of Accounts Topics
  IF v_acc_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_acc_id, 'Principles of Double Entry & Ledger'),
      (v_acc_id, 'Cashbook, Petty Cash & Bank Reconciliation'),
      (v_acc_id, 'Trial Balance & Correction of Errors'),
      (v_acc_id, 'Financial Statements of Sole Proprietors'),
      (v_acc_id, 'Partnership Accounts'),
      (v_acc_id, 'Company Accounts & Ratio Analysis')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Agricultural Science Topics
  IF v_agric_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_agric_id, 'General Agriculture & Land Use'),
      (v_agric_id, 'Soil Science & Plant Nutrients'),
      (v_agric_id, 'Crop Production & Crop Protection'),
      (v_agric_id, 'Animal Production & Husbandry'),
      (v_agric_id, 'Agricultural Economics & Extension')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Geography Topics
  IF v_geo_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_geo_id, 'Map Reading & Interpretation'),
      (v_geo_id, 'The Earth & Solar System'),
      (v_geo_id, 'Rocks, Landforms & Geomorphology'),
      (v_geo_id, 'Weather, Climate & Biomes'),
      (v_geo_id, 'Human & Regional Geography of Nigeria')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Computer Studies Topics
  IF v_comp_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_comp_id, 'Fundamentals of Computing & Hardware'),
      (v_comp_id, 'Operating Systems & System Software'),
      (v_comp_id, 'Word Processing, Spreadsheets & DBMS'),
      (v_comp_id, 'Computer Networking, Internet & Cybersecurity'),
      (v_comp_id, 'Algorithms, Flowcharts & Programming Concepts')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Christian Religious Studies Topics
  IF v_crs_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_crs_id, 'Sovereignty of God & Creation'),
      (v_crs_id, 'Leadership in the Old Testament'),
      (v_crs_id, 'Prophetic Warnings & Covenant with God'),
      (v_crs_id, 'The Early Life & Ministry of Jesus'),
      (v_crs_id, 'The Passion, Death & Resurrection of Christ'),
      (v_crs_id, 'The Early Church & Apostolic Missions')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Islamic Religious Studies Topics
  IF v_irs_id IS NOT NULL THEN
    INSERT INTO topics (subject_id, name) VALUES
      (v_irs_id, 'Tawheed & Articles of Faith'),
      (v_irs_id, 'The Glorious Quran & Hadith Studies'),
      (v_irs_id, 'Fiqh: Taharah, Salah, Zakat, Sawm & Hajj'),
      (v_irs_id, 'Sirah: Life of Prophet Muhammad (SAW)'),
      (v_irs_id, 'The Rightly Guided Caliphs & Islamic History')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
