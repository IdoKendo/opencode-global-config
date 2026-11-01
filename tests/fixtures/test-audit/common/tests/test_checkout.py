import unittest
from checkout import checkout_total


class CheckoutTests(unittest.TestCase):
    def test_paid_delivery(self):
        self.assertEqual(checkout_total(49), 54)

    def test_free_delivery(self):
        self.assertEqual(checkout_total(51), 51)
