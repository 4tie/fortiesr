import json

with open(r'l:\M4tie\Documents\fortiesr\user_data\auto_quant\88f15262-42e1-4e4e-9de0-f847ba8fb54c\discovery_result.json') as f:
    data = json.load(f)

trades = data['strategy']['AIStrategy']['trades']
pair_stats = {}

for t in trades:
    pair = t['pair']
    if pair not in pair_stats:
        pair_stats[pair] = {'trades': 0, 'profit_abs': 0, 'wins': 0, 'profit_total': 0, 'loss_total': 0}
    pair_stats[pair]['trades'] += 1
    pair_stats[pair]['profit_abs'] += t['profit_abs']
    if t['profit_abs'] > 0:
        pair_stats[pair]['wins'] += 1
        pair_stats[pair]['profit_total'] += t['profit_abs']
    else:
        pair_stats[pair]['loss_total'] += abs(t['profit_abs'])

print('Per-pair results from discovery backtest:')
print('=' * 80)
sorted_pairs = sorted(pair_stats.items(), key=lambda x: x[1]['profit_abs'], reverse=True)
for pair, stats in sorted_pairs:
    win_rate = stats['wins'] / stats['trades'] * 100 if stats['trades'] > 0 else 0
    profit_factor = stats['profit_total'] / stats['loss_total'] if stats['loss_total'] > 0 else 0
    print(f"{pair:15s} | {stats['trades']:4d} trades | ${stats['profit_abs']:7.2f} profit | {win_rate:5.1f}% win rate | PF: {profit_factor:.2f}")

print('\n' + '=' * 80)
print(f"Total pairs tested: {len(pair_stats)}")
print(f"Total trades: {len(trades)}")
