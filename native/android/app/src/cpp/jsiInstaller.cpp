#include "CommCoreModule.h"
#include "SQLiteQueryExecutor.h"
#include "jniHelpers.h"
#include <CallInvokerHolder.h>
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>

namespace jni = facebook::jni;
namespace jsi = facebook::jsi;
namespace react = facebook::react;

class CommHybrid : public jni::HybridClass<CommHybrid> {
public:
  static auto constexpr kJavaDescriptor = "Lapp/comm/fbjni/CommHybrid;";

  static void initHybrid(
      jni::alias_ref<jhybridobject> jThis,
      jlong jsContext,
      jni::alias_ref<react::CallInvokerHolder::javaobject> jsCallInvokerHolder,
      comm::HashMap additionalParameters) {
    jsi::Runtime *rt = (jsi::Runtime *)jsContext;
    auto jsCallInvoker = jsCallInvokerHolder->cthis()->getCallInvoker();
    std::shared_ptr<comm::CommCoreModule> nativeModule =
        std::make_shared<comm::CommCoreModule>(jsCallInvoker);

    if (rt != nullptr) {
      rt->global().setProperty(
          *rt,
          jsi::PropNameID::forAscii(*rt, "CommCoreModule"),
          jsi::Object::createFromHostObject(*rt, nativeModule));
    }

    jni::local_ref<jni::JObject> sqliteFilePathObj =
        additionalParameters.get("sqliteFilePath");
    comm::SQLiteQueryExecutor::sqliteFilePath = sqliteFilePathObj->toString();
  }

  static void registerNatives() {
    javaClassStatic()->registerNatives({
        makeNativeMethod("initHybrid", CommHybrid::initHybrid),
    });
  }

private:
  friend HybridBase;
};

JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] { CommHybrid::registerNatives(); });
}
