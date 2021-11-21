class Observer {
  constructor(data) {
    this.observe(data);
  }
  //监听对象
  observe(data) {
    if (data && data instanceof Object) {
      Object.keys(data).forEach((key) => {
        this.defineReactive(data, key, data[key]);
      });
    }
  }
  //数据劫持实现
  defineReactive(obj, key, value) {
    this.observe(value);
    const dep = new Dep();
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: false,
      get() {
        //订阅数据变化时，收集观察者
        Dep.target && dep.addSUb(Dep.target);
        return value;
      },
      set: (newVal) => {
        this.observe(newVal);
        if (newVal !== value) value = newVal;
        //通知变化
        dep.notify();
      }
    });
  }
}

//依赖收集
class Dep {
  constructor() {
    this.subs = [];
  }
  //收集观察者
  addSUb(watcher) {
    this.subs.push(watcher);
  }
  notify() {
    console.log('观察者', this.subs);
    this.subs.forEach((w) => w.update());
  }
}

//观察者
class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    //存储旧值
    this.oldVal = this.getOldVal();
  }
  getOldVal() {
    Dep.target = this;
    const oldVal = compileUtil.getVal(this.expr, this.vm);
    Dep.target = null;
    return oldVal;
  }
  update() {
    const newVal = compileUtil.getVal(this.expr, this.vm);
    if (newVal !== this.oldVal) this.cb(newVal);
  }
}
