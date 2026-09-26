import Base
import ./main.bend as Demo

# The browser may refuse storage; never misreport that result as saved.
law storage_failure_is_reported:
  {Demo.storage_message(False{}) == "Storage is unavailable. Your signal still ran." : String}

law storage_success_is_reported:
  {Demo.storage_message(True{}) == "Saved to this browser." : String}
