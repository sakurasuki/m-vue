const compileUtil = {
  getVal(expr, vm) {
    //校验参数是不是对象
    if (expr.indexOf('{') === -1) {
      return expr.split('.').reduce((data, currentVal) => {
        return data[currentVal];
      }, vm.$data);
    } else return eval(`(${expr})`);
  },
  setVal(expr, vm, inputVal) {
    return expr.split('.').reduce((data, currentVal) => {
      if (typeof data[currentVal] !== 'object') {
        data[currentVal] = inputVal;
      }
      return data[currentVal];
    }, vm.$data);
  },
  //解析双括号
  getContentVal(expr, vm) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(args[1], vm);
    });
  },
  text(node, expr, vm) {
    let value;
    //处理一下元素文本是否带有{{}}标签
    if (expr.indexOf('{{') !== -1) {
      value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        new Watcher(vm, args[1], (newVal) => {
          this.updater.textUpdater(node, this.getContentVal(expr, vm));
        });
        return this.getVal(args[1], vm);
      });
    } else value = this.getVal(expr, vm);
    this.updater.textUpdater(node, value);
  },
  html(node, expr, vm) {
    const value = this.getVal(expr, vm);
    new Watcher(vm, expr, (newVal) => {
      this.updater.htmlUpdater(node, newVal);
    });
    this.updater.htmlUpdater(node, value);
  },
  for(node, expr, vm) {},
  model(node, expr, vm) {
    const value = this.getVal(expr, vm);
    new Watcher(vm, expr, (newVal) => {
      this.updater.modelUpdater(node, newVal);
    });
    node.addEventListener('input', (e) => {
      this.setVal(expr, vm, e.target.value);
    });
    this.updater.modelUpdater(node, value);
  },
  on(node, expr, vm, eventName) {
    //获取methods里的函数并绑定
    const fn = vm.$options.methods?.[expr];
    node.addEventListener(eventName, fn.bind(vm), false);
  },
  bind(node, expr, vm, attrName) {
    const value = this.getVal(expr, vm);
    new Watcher(vm, expr, (newVal) => {
      this.updater.bindUpdater(node, newVal, attrName);
    });
    this.updater.bindUpdater(node, value, attrName);
  },
  //更新函数
  updater: {
    //解析指令v-text更新
    textUpdater: (node, value) => (node.textContent = value),
    //解析指令v-html更新
    htmlUpdater: (node, value) => (node.innerHTML = value),
    //解析指令v-model更新
    modelUpdater: (node, value) => (node.value = value),
    bindUpdater: (node, value, attrName) => {
      //处理一下参数
      if (value instanceof Object) {
        let objStr = '';
        Object.keys(value).forEach((key) => {
          objStr += `${key}:${value[key]};`;
          node.setAttribute(attrName, objStr);
        });
      } else node.setAttribute(attrName, value);
    }
  }
};
class Compile {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    //1.获取文档碎片对象，放入内存中会减少页面的回流和重绘
    const fragment = this.node2Fragment(this.el);
    //2.编译模板
    this.compile(fragment);
    //3.追加元素到根元素
    this.el.appendChild(fragment);
  }
  /**
   *
   * @param {*} fragment
   */
  compile(fragment) {
    //1.获取子节点
    const childNodes = fragment.childNodes;
    [...childNodes].forEach((child) => {
      //  判断 元素节点/文本节点
      if (this.isElementNode(child)) {
        // console.log('元素', child);
        this.compileElement(child);
      } else {
        // console.log('文本', child);
        this.compileText(child);
      }
      //判断当前元素是否还有子节点 有则递归调用
      if (child.childNodes && child.childNodes.length) this.compile(child);
    });
  }
  /**判断自定义指令 */
  isDirective(attrName) {
    return attrName.startsWith('v-');
  }
  isEventName(attrName) {
    return attrName.startsWith('@');
  }
  /**编译元素节点 */
  compileElement(node) {
    //获取元素节点所有属性
    const { attributes } = node;
    [...attributes].forEach((attr) => {
      const { name, value } = attr;
      if (this.isDirective(name)) {
        const [, dirctive] = name.split('-'); //解析自定义指令 v-xxx->xxx
        const [dirName, eventName] = dirctive.split(':'); //解析v-on:click->click
        //更新数据 数据驱动视图
        compileUtil[dirName](node, value, this.vm, eventName);
        //删除有指令的标签上的属性
        node.removeAttribute('v-' + dirctive);
      } else if (this.isEventName(name)) {
        //解析@语法糖相关指令
        const [, evenName] = name.split('@'); //解析自定义指令 v-xxx->xxx
        compileUtil['on'](node, value, this.vm, evenName);
        //删除有指令的标签上的属性
        node.removeAttribute('@' + evenName);
      }
    });
  }
  /**编译元素文本 */
  compileText(node) {
    const content = node.textContent;
    if (/\{\{(.+?)\}\}/.test(content)) {
      //筛选出来带有{{}}的文本
      compileUtil['text'](node, content, this.vm);
    }
  }
  /**创建文档碎片 */
  node2Fragment(el) {
    const f = document.createDocumentFragment();
    let firstChild;
    while ((firstChild = el.firstChild)) {
      f.appendChild(firstChild);
    }
    return f;
  }
  isElementNode(node) {
    return node.nodeType === 1;
  }
}
class Mvue {
  constructor(options) {
    const { el, data } = options;
    this.$el = el;
    this.$data = data;
    this.$options = options;
    if (this.$el) {
      /**实现一个数据观察者 */
      new Observer(this.$data);
      /**实现一个指令解析器 */
      new Compile(this.$el, this);
      //代理this指针this => this.$data
      this.proxyData(this.$data);
    }
  }
  proxyData(data) {
    for (const key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key];
        },
        set(newVal) {
          data[key] = newVal;
        }
      });
    }
  }
}
