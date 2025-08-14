[![CI](https://github.com/oguzcamurr/algo-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/oguzcamurr/algo-showcase/actions/workflows/ci.yml)
# Algo Showcase (Demo)

> **Not:** Bu depo vitrin amaçlıdır. Canlı trade yok, parametreler maskeli, sentetik veri kullanılır.

## Neler var?
- Basit sinyal (EMA/RSI) — `src/signals.py`
- Mini backtest — `src/backtest.py`
- Flask API + sayfa — `web/app.py` (`/` ve `/api/latest`)
- Birim test — `tests/test_backtest.py`

## Çalıştırma
```bash
python -m venv .venv && source .venv/bin/activate
pip install pandas numpy flask pytest
python web/app.py  # http://127.0.0.1:5000

