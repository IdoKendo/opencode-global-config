from shipping import delivery_charge


def checkout_total(subtotal):
    return subtotal + delivery_charge(subtotal)
