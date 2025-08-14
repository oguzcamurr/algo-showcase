import numpy as np, pandas as pd

def ema(s, n): return s.ewm(span=n, adjust=False).mean()

def rsi(s, n=14):
    d = s.diff(); up, dn = d.clip(lower=0), -d.clip(upper=0)
    rs = up.rolling(n).mean() / dn.rolling(n).mean().replace(0, np.nan)
    return 100 - (100/(1+rs))

def compute_signal(df):
    df = df.copy()
    df["ema_fast"] = ema(df["close"], 7)
    df["ema_slow"] = ema(df["close"], 25)
    df["rsi"] = rsi(df["close"], 14)
    df["direction"] = np.where(df["ema_fast"] > df["ema_slow"], "BUY", "SELL")
    df["confidence"] = np.where(df["rsi"].between(45,55), 60, 75)  # DEMO
    return df
