#pragma once

#include "DatabaseQueryExecutor.h"
#include "entities/Draft.h"

#include <string>

namespace comm {

class SQLiteQueryExecutor : public DatabaseQueryExecutor {
  void migrate();
  static auto getStorage();

public:
  static std::string sqliteFilePath;

  SQLiteQueryExecutor();
  std::string getDraft(std::string key) const override;
  void updateDraft(std::string key, std::string text) const override;
  std::vector<Draft> getAllDrafts() const override;
};

} // namespace comm
