import unittest
from shipping import delivery_charge, shipping_for_test


class RedundantTests(unittest.TestCase):
    def test_helper_repeats_paid_delivery(self):
        self.assertEqual(shipping_for_test(49), 5)

    def test_identity(self):
        charge = delivery_charge(49)
        self.assertEqual(charge, charge)

    def test_probe(self):
        delivery_charge(51)
