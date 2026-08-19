import unittest
from pathlib import Path

from backend.server import ApiError, evaluate_path, read_json, validate_learning_path


class LearningPathModelTests(unittest.TestCase):
    def test_default_path_is_valid(self):
        payload = read_json(Path("backend/data/default-learning-path.json"))
        validate_learning_path(payload)

    def test_rejects_assessment_metric_on_unit_rule(self):
        payload = read_json(Path("backend/data/default-learning-path.json"))
        payload["edges"][3]["conditions"]["rules"] = [
            {
                "id": "bad-rule",
                "sourceType": "unit",
                "sourceNodeId": "node-math-2-advanced",
                "metric": "score",
                "operator": "gte",
                "value": 50
            }
        ]
        with self.assertRaises(ApiError):
            validate_learning_path(payload)

    def test_evaluates_low_score_branch(self):
        result = evaluate_path(
            "default",
            {
                "currentNodeId": "node-math-1",
                "nodes": {
                    "node-math-1": {
                        "completion": True,
                        "passed": False,
                        "score": 42
                    }
                }
            },
        )
        self.assertEqual(result["nextNodeId"], "node-math-2-easy")

    def test_evaluates_passed_branch(self):
        result = evaluate_path(
            "default",
            {
                "currentNodeId": "node-math-1",
                "nodes": {
                    "node-math-1": {
                        "completion": True,
                        "passed": True,
                        "score": 78
                    }
                }
            },
        )
        self.assertEqual(result["nextNodeId"], "node-math-2-advanced")


if __name__ == "__main__":
    unittest.main()
