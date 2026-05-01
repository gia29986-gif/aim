import unittest
import time
from AimController import AimController

class TestAimController(unittest.TestCase):
    def setUp(self):
        self.controller = AimController()

    def test_initial_status(self):
        status = self.controller.get_status()
        self.assertTrue(status["active"])
        self.assertEqual(status["version"], "9.1.0")

    def test_drag_aim_logic(self):
        # First signal to establish baseline
        signal = {"type": "drag", "x": 10, "y": 10}
        response = self.controller.receive_signal(signal)
        
        self.assertEqual(response["status"], "success")
        self.assertIn("offset", response)
        self.assertGreater(response["offset"]["x"], 0)
        # Vertical boost should make Y offset larger than X if inputs are same
        self.assertGreater(response["offset"]["y"], response["offset"]["x"])

    def test_aimlock_signal(self):
        signal = {"type": "lock", "target": "head"}
        response = self.controller.receive_signal(signal)
        
        self.assertEqual(response["status"], "success")
        self.assertEqual(response["target"], "head")
        self.assertEqual(self.controller.lock_target, "head")

    def test_latency_performance(self):
        signal = {"type": "drag", "x": 1.0, "y": 1.0}
        response = self.controller.receive_signal(signal)
        
        # Latency should be extremely low (< 1ms on local execution)
        self.assertLess(response["latency_ms"], 1.0)

    def test_inactive_controller(self):
        self.controller.is_active = False
        signal = {"type": "drag", "x": 1.0, "y": 1.0}
        response = self.controller.receive_signal(signal)
        
        self.assertEqual(response["status"], "error")
        self.assertEqual(response["message"], "Controller inactive")

if __name__ == "__main__":
    unittest.main()
