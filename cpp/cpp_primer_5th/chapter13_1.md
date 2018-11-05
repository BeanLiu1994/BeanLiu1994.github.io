# 13 拷贝控制

定义一个类时，可以显式或隐式地指定在此类型的对象拷贝、移动、赋值和销毁时做什么。这些由一些特殊的成员函数控制：
* 拷贝构造函数(copy constructor)
* 拷贝赋值运算符(copy-assignment operator)
* 移动构造函数(move constructor)
* 移动赋值运算符(move-assignment operator)
* 析构函数(destructor)

这些操作称为拷贝控制操作。

（如果不自行定义，编译器可能会为我们定义。）

移动操作是c++11新引入的操作。

## 13.1 拷贝、赋值与销毁

### 13.1.1 拷贝构造函数
```c++
class Foo
{
public:
    Foo();              // 默认构造函数
    Foo(const Foo&);    // 拷贝构造函数
};
```

* 拷贝构造函数第一个参数一定是引用类型，不一定是const的，但通常是const的。
* 拷贝构造函数通常会被隐式地调用，所以不是explicit的（见第7章）。

如果没有定义一个拷贝构造函数，编译器会定义一个合成的构造函数。但在定义了其他构造函数的情况下，编译器也会为我们合成一个构造函数。

#### 拷贝初始化

直接初始化即直接匹配对应的构造函数。
拷贝初始化则将右侧对象拷贝到正在创建的对象中。（可能类型转换）
```c++
string dots(10, '.');   // 直接初始化
string s(dots);         // 直接初始化
string s2 = dots;       // 拷贝初始化
string null_book = "te";// 拷贝初始化
string nines = string(10, '9'); // 拷贝初始化
```
拷贝初始化通常使用拷贝构造函数完成，但如果类有移动构造函数，则可能不会使用拷贝构造函数。

拷贝初始化发生在：
* 用 = 定义变量。
* 将一个对象作为实参传递给一个非引用类型的形参。
* 从一个返回类型为非引用类型的函数返回一个对象。
* 用花括号列表初始化一个数组中的元素或一个聚合类中的成员。
* 标准库中insert或push成员，进行的是拷贝初始化。emplace则为直接初始化。

#### 参数和返回值

函数调用过程中，具有非引用类型的参数，需要进行拷贝初始化。同样非引用类型返回值被用来初始化调用方的结果。

拷贝构造函数的输入参数为引用类型，这是因为不会发生拷贝初始化。否则将会自身调用自身，无限循环下去。

#### 编译器可以绕过拷贝构造函数

```c++
string null_book = "test"; //拷贝初始化
//编译器改写为：
string null_book("test"); //编译器改写
```
实际使用上就不会再运行拷贝/移动构造函数了。
虽说绕过了拷贝/移动构造函数，但它们必须是存在且可以访问的。


### 13.1.2 拷贝赋值运算符

如果类未定义自己的拷贝赋值运算符，编译器将合成一个。

某些运算符（包括赋值运算符），需要定义为成员函数。
```c++
struct Type{
    Type& operator=(const Type&); //赋值运算符
}
```
通常返回一个指向运算符左侧对象的引用。
标准库通常要求保存在容器中的类型要具有赋值运算符，且返回值为左侧运算对象的引用。

#### 合成拷贝赋值运算符

某些情况下合成的拷贝赋值运算符是用来禁止赋值操作的。（见13.1.6）

如果拷贝赋值运算符并非上述目的，它会将右侧对象的每个非静态成员赋予左侧运算对象的对应成员。（通过每个成员对应类型的拷贝赋值运算符完成）。


### 13.1.3 析构函数

#### 析构函数的工作

构造函数有一个初始化部分和一个函数体，对应来说析构函数也有一个函数体和一个析构部分。

构造函数：
1. 成员初始化
2. 函数体执行

析构函数：
1. 函数体执行
2. 成员销毁，顺序与构造函数初始化相反

销毁成员只是调用对应类型的析构函数，如果是内置类型，则什么也不需要做，最终释放内存。所以一个内置指针类型销毁时不会调用delete释放空间。

#### 析构函数调用时机
* 变量离开作用域
* 对象销毁时，其成员销毁
* 容器销毁时，其元素销毁
* 动态分配的对象，调用delete时
* 临时对象在表达式结束时销毁。

#### 合成析构函数
当一个类未定义自己的析构函数时，编译器会定义一个合成析构函数。同样对于某些类它是用来阻止销毁的。如果不是这种情况，函数体默认为空的。

### 13.1.4 三/五法则

有三个基本操作可以控制类的拷贝操作：
* 拷贝构造函数
* 拷贝赋值运算符
* 移动构造函数
* 移动赋值运算符
* 析构函数

这些操作可以只去定义其中一个或两个，但它们实际上应被看作一个整体，通常只需要其中一个操作而不需要所有操作的情况是很少见的。

#### 需要析构函数的类也需要拷贝和赋值操作

如果一个类在析构函数中需要额外操作，那么几乎可以肯定，它也需要自定义的拷贝复制运算符和拷贝构造函数。

同样，需要拷贝构造函数的类也需要赋值的操作。

### 13.1.5 使用=default

可以显式地要求编译器生成合成的版本。
```c++
struct Type{
    Type() = default;
    Type(const Type&) = default;
    Type& operator=(const Type&);
    ~Type() = default;
};
Type& Type::operator=(const Type&) = default;
```
此种写法构造函数会被隐式地生成为内联的。
如果不需要内联，可以在定义处写为=default。
使用=default的函数必须是可合成的。

### 13.1.6 阻止拷贝

对于某些类，拷贝或赋值没有合理的意义。此时需要阻止拷贝或赋值的发生。

#### 定义删除的函数

类似=default，通过=delete可以定义为删除的函数。
```c++
struct NoCopy{
    NoCopy() = default;
    NoCopy(const NoCopy&) = delete;
    NoCopy &operator=(const NoCopy&) = delete;
    ~NoCopy() = default;
};
```
=delete必须出现在第一次声明时，而且不必须对可合成的函数使用。

=delete可以用在普通的函数声明上，表示不匹配此函数。

#### 析构函数不可删除

析构函数如果删除了，则无法销毁此类型的对象。

将无法：
* 定义该类型的变量
* 创建该类型的临时变量
* 释放指向该类型动态分配对象的指针

```c++
struct NoDtor{
    NoDtor() = default;
    ~NoDtor() = delete;
    NoDtor_dtor(){...}
};
NoDtor nd;               // error
NoDtor *p = new NoDtor();// ok
delete p;                // error
```
这种方式可以提供一种很不常见的访问控制，此时变量只能被创建在堆中，而不能在栈内。
虽然无法使用自带的delete释放指针，但可以使用：
* 一个代替析构行为的函数来释放类内需要手动释放的资源。
* operator delete来直接释放对象的内存。

【以上的方式很不常见，仅供参考】

#### 合成的拷贝控制成员可能是删除的

删除或不可访问的成员|拷贝构造|拷贝赋值|析构|默认构造
--|--|--|--|--
拷贝构造|删除|--|--|删除(因为声明了一个构造，虽然是delete的，成员没有默认构造)
拷贝赋值|--|删除|--|--
析构|删除|--|删除|删除
含const成员| --|删除|--|无类内初始化器且无默认构造，删除
含引用成员| --|删除|--|若无类内初始化器，删除
含移动操作|删除|删除|--|--

上表列出了当有成员（第一列）为删除或不可访问时，这个类合成的拷贝控制成员的情况。

当不可能拷贝、赋值和销毁类的成员时，对应的合成拷贝控制成员函数就被定义为删除的。

#### private拷贝控制

新标准前，类通过控制访问权限来阻止拷贝。

如果一个函数永远也不会被用到，那么它可以只有声明，没有定义。
此时，声明但不定义一个成员函数是合法的，因为拷贝构造不会被用到。当友元或类内访问时，会出现链接错误。

c++11新标准出现后，应使用=delete来控制。

## 13.2 拷贝控制和资源管理

类的常见的拷贝语义：
* 行为像一个值
* 行为像一个指针
* other

类的行为像一个值，意味着它有自己的状态。当拷贝一个像值的对象时，副本和原对象是完全独立的。改变副本不会影响原对象。如string。

类的行为像指针，即共享状态。拷贝一个这样的对象时，副本和原对象使用相同的底层数据。改变副本也会影响原对象。如shared_ptr。

如unique_ptr，两种都不像。

### 13.2.1 行为像值的类

编写赋值运算符时需要注意：
* 如果一个对象赋值给自身，运算符应正常工作。
* 大多数赋值运算符结合了析构函数和拷贝构造函数的工作。

### 13.2.2 行为像指针的类

直接使用shared_ptr管理资源即可。

如果要自行实现资源的管理，使用引用计数。

#### 引用计数

* 除了初始化对象外，额外创建一个引用计数，用来记录有多少对象共享状态，默认为1。
* 拷贝构造函数不分配新的计数器，而是拷贝计数器和数据成员的引用（或指针），并递增共享的计数器。
* 析构函数递减计数器，如果技术其变为0，则释放共享的内存。
* 拷贝赋值运算符，递增右侧运算对象的计数器，递减左侧运算对象的计数器。同样类似析构，如果左侧对象计数为0，则释放其内存。注意自赋值的情况。

计数器同样和数据保存在动态内存中。