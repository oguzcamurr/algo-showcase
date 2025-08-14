import pandas as pd
from src.backtest import backtest

def test_backtest_runs():
    df = pd.DataFrame({
        "close":[100,101,99,102,101],
        "high":[101,102,100,103,102],
        "low":[99,100,98,100,100],
        "direction":["BUY","SELL","BUY","SELL","BUY"]
    })
    out = backtest(df, tp=0.01, sl=0.01)
    assert "pf" in out and "trades" in out
