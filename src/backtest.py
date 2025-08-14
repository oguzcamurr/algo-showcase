import pandas as pd

def backtest(df, tp=0.01, sl=0.01):
    res=[]
    for i in range(len(df)-1):
        row, nxt = df.iloc[i], df.iloc[i+1]
        entry = row["close"]
        if row["direction"]=="BUY":
            tp_hit = nxt["high"]>=entry*(1+tp); sl_hit = nxt["low"]<=entry*(1-sl)
        else:
            tp_hit = nxt["low"]<=entry*(1-tp);  sl_hit = nxt["high"]>=entry*(1+sl)
        res.append(tp if tp_hit else (-sl if sl_hit else 0))
    s = pd.Series(res)
    pf = (s[s>0].sum() / max(1e-9, -s[s<0].sum())) if (s[s<0].sum()!=0) else float("inf")
    return {"trades": len(s), "pf": round(pf,2), "win%": round((s>0).mean()*100,1)}
