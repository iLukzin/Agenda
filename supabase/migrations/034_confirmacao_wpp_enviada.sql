-- Controle para não reenviar confirmação WhatsApp
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS confirmacao_wpp_enviada BOOLEAN DEFAULT FALSE;

-- Resetar ao cancelar ou reagendar (opcional - feito pelo código)
