注： 以下一些为书上的摘抄，记录仅供参考，不太敢保证完全正确。
# 6.2.3 const 形参(parameter)和实参(arguement)
```c++
void fcn(const int i);
void fcn(int i);// 此处为重定义，会出错
```
当用实参初始化形参时，顶层const会被忽略，所以形参有顶层const时，在调用时无法区分，仅能在函数体内体会到差异。为了防止这种问题，如果同时定义了两个函数，将会报出重定义错误。
同样，类的成员函数也是这样。
# 6.2.4 数组形参
```c++
int f(int(&v)[10], int i);//传引用
int f(int v[][10], int i);//传指针
int f(int (*v)[10], int i);//传指针,但不能与上一行同时出现，否则重定义。
```
# 6.3.3 返回数组指针
```c++
// 1
int (*func(int i))[10]
{...}
// 2 
typedef int arrT[10];
// 或 using arrT = int[10];
arrT* func(int i)
{...}
// 3
auto func(int i) -> int(*)[10]
{...}
// 4
int odd[] = {...};
decltype(odd) *func(int i)
{...}
```
# 6.4.1 重载与作用域
```c++
void print(double&);
int main()
{
int v1=1;
double v2=3.14;
void print(int&);
print(v1);
print(v2);// error
return 0;
}
```
main函数作用域内有print(int&)的声明，将print(double)屏蔽，所以print(v2)无法找到匹配的函数。
一旦在当前作用域查找到了所需的名字，编译器就会忽略掉外层作用域中的同名实体。
例如下面的例子不会报错，但实际上进入了不期望的函数。
```c++
void print(double);
int main()
{
void print(int);
print(1);
print(3.14);// ok，但使用的是print(int)
return 0;
}
```
# 6.5.1 默认实参
```c++
int a_init = 5;
void test(int a, char b, double c = 3.14);// 不能修改最后一个
void test(int a = a_init, char b = 'k', double c);//但能添加之前的
int main()
{
    test();
    return 0;
}
void test(int a, char b, double c)
{
    cout << a << " " << b << " " << c << endl;
    return;
}
// 输出: "5 k 3.14"
```
甚至可以用函数返回值做默认参数
```c++
int a_init() 
{
    static int t = 0;
    return ++t;
};
void test(int a, char b, double c = 3.14);// 不能修改最后一个
void test(int a = a_init(), char b = 'k', double c);//但能添加之前的
int main()
{
    test();
    test();
    test();
    return 0;
}
void test(int a, char b, double c)
{
    cout << a << " " << b << " " << c << endl;
    return;
}
// 输出:
// 1 k 3.14
// 2 k 3.14
// 3 k 3.14
```
# 6.5.2 内联函数和constexpr函数
通常放到头文件内，因为多个定义的实现必须一致。
constexpr一个用法的示例：
```c++
template<int i>
constexpr int fib()
{
    return fib<i - 1>() + fib<i - 2>();
}
template<>
constexpr int fib<1>()
{
    return 1;
}
template<>
constexpr int fib<0>()
{
    return 1;
}
const int t = fib<6>();//编译期即可得到 t = 13
```
# 6.5.3 调试帮助
使用assert(expr)在运行时检测一些不可能发生的条件。
使用NDEBUG宏可以禁用assert的功能。
assert仅是辅助措施，不能用于程序本身应有的错误检查。
编译器定义了一些宏：
```c++
__func__
//存放当前函数名字的字符串
__FILE__
//存放文件名的字符串
__LINE__
//存放行号的整形
__DATE__
//存放编译时间的字符串
__TIME__
//存放编译日期的字符串

//例如：
#include <iostream>
#include <sstream>
#include <stdexcept>
#define CHECK(x) if(!(x)) {\
    std::stringstream what;\
    what<< "Assertion Failed While Running [ " <<#x<<" ]"<<std::endl\
        <<"\tINFO:\tFILE ["<<__FILE__<<"] LINE ["<<__LINE__<<"]"<<std::endl\
        <<"\t\tCompilation finished at "<<__DATE__<<" "<<__TIME__;\
    std::cerr << what.str() << std::endl;throw std::runtime_error(what.str());\
}
// 运行时检查
int main(){
29行 CHECK(false);
}
// 输出：
//Assertion Failed While Running [ false ]
// INFO: FILE [...\main.cpp] LINE [29]
// In function [main] Compilation finished at ...
```
# 6.7 函数指针
```c++
//一个正常函数
bool test(const string&, const string&) { return true; }
//一个函数指针，此处pf为指针
bool(*pf)(const string&, const string&);
int main()
{
    pf = test;
    pf = &test;//两种方式均可
    pf = nullptr;
    pf = 0;
pf(str1,str2);
(*pf)(str1,str2);//均可
    return 0;
}
//注意和下面区分
bool(*pf(const string&, const string&));
//即 bool* pf(const string&, const string&);
```
做形参的话：
```c++
void f(bool(*pf)(const string&, const string&));
void f(bool pf(const string&, const string&));//均可
typedef bool Func(const string&, const string&);
typedef decltype(test) Func2;//与Func相同
typedef bool (*FuncP)(const string&, const string&);
typedef decltype(test)* FuncP2;//与FuncP相同
void f(Func);
void f(FuncP2);//与上一个声明相同
```
做返回值的话，必须使用指针。
```c++
int test(int*,int);
using F = int(int *,int);
using PF = int(*)(int *,int);
PF f(int);
F* f(int);//同上
int (*f(int))(int*,int);//同上
auto f(int) -> int(*)(int*,int);//同上
decltype(test) *f(int);//同上
F f(int);//错误，不能返回函数类型，只能返回函数指针
```

# 7.1.2 关于inline
定义在类内部的函数是隐式的inline函数。
# 7.3.1 关于inline
可以在类外部，用inline修饰成员函数的定义。类内声明可以不添加。不过inline后的函数一般会放在头文件内。
# 7.5.2 委托构造函数
```c++
class A
{
public:
    A(int, char, string) {}
    A(int t) :A(t, 'c', "test") {}
    A() :A(0) {}
};
```
# 7.5.5 聚合类
聚合类：
* 所有成员都是public的。
* 没有定义构造函数。
* 没有类内初始值。
* 没有基类。

```c++
struct Data
{
    int val;
    string s;
};
Data val1 = {0,"test"};//初始化方式
```
# 7.5.6 字面值常量类
构造函数可以是constexpr的，但要同时满足**构造函数**的要求和**constexpr函数的要求**。
constexpr构造函数用于生成constexpr对象。
