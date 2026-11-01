def delivery_charge(total):
    return 0 if total >= 50 else 5


def shipping_for_test(total):
    return delivery_charge(total)
