class BaseParameter:
    def __init__(self, *args, default=None, space=None, **kwargs):
        self.default = default
        self.space = space
        self.value = default


class IntParameter(BaseParameter):
    pass


class DecimalParameter(BaseParameter):
    pass


class RealParameter(BaseParameter):
    pass


class CategoricalParameter(BaseParameter):
    pass


class BooleanParameter(BaseParameter):
    pass


class IStrategy:
    INTERFACE_VERSION = 3


class Trade:
    is_short = False
    leverage = 1.0


class Order:
    pass


class PairLocks:
    pass


informative = None


def merge_informative_pair(pair, informative_pair, timedeltas=None):
    return None


def timeframe_to_next_date(timeframe, date):
    return None


def timeframe_to_prev_date(timeframe, date):
    return None


def stoploss_from_absolute(price, current_rate, current_timeframe):
    return None


def stoploss_from_open(open_relative_stop, current_profit, is_short=False, leverage=1.0):
    return None


def timeframe_to_minutes(timeframe):
    return None
