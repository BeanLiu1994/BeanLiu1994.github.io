注： 以下一些为书上的摘抄，记录仅供参考，不太敢保证完全正确。
# 3.2.2 string对象上的操作
string有比较操作符，是字典序比较。
```c++
string s;
cin>>s;// 会忽略空白字符，并读取到下一个空白字符。
int n=-1;
s.size()<n;//由于类型转换导致结果一直为true
```
字符串字面值是 const char[len] 的，结尾会带有一个'\0'。
string可访问的部分没有'\0';

一些转换：
```c++
// stoi
int stoi(const string& str, size_t* pos = 0, int base = 10);
// pos为结束位置的后一个。

// 规则
// str的开头丢弃isspace(c)==true的字符，直到对应位置可转换的pos。
// base如果设置为0为自动检测，
// 开头的0x或0X代表16进制；
// 开头的0代表数字为8进制。

// 类似函数还有：
long stol(const string& str, size_t* pos = 0, int base = 10);
long long stoll(const string& str, size_t* pos = 0, int base = 10);
float stof(const string& str, size_t* pos = 0);
double stod(const string& str, size_t* pos = 0);
long double stold(const string& str, size_t* pos = 0);
```

# 3.2.3 一些字符的操作
```c++
char c;
isalnum(c);// true: c为字母或数字
isalpha(c);// true: c为字母
iscntrl(c);// true: c为控制字符
isdigit(c);// true: c为数字
isgraph(c);// true: c为不是空格且可打印
islower(c);// true: c为小写字母
isprint(c);// true: c为可打印字符(可视字符)
ispunct(c);// true: c为标点符号(不是cntrl、space、digit、alpha中的一个即为符号)
isspace(c);// true: c为空白(空格、横向制表符、纵向制表符、回车符、换行符、进纸符)
isupper(c);// true: c为大写字母
isxdigit(c);// true: c为十六进制数字
tolower(c);//转为小写字母
toupper(c);//转为大写字母
```
# 3.3.1 定义和初始化vector对象
初始化时如果花括号没有对应的列表初始化方法，会作为圆括号匹配其他的初始化方法。
```c++
vector<string> t1{ 10,"test" };
// 与vector<string> t(10,"test")相同;size为10
vector<string> t2{ "10","test" };
// 结果为size为2的vector
// 由于10不能转换为string，匹配了圆括号的初始化方法

//对比：
string t3{10,'t'};
// 结果为 "\nt"  由于10可以转为char所以匹配了Initializer_list的方法。
string t3_5 {149, 't'};//err
// 不能损失精度，而149越界，此句错误

vector<int> t4{0.1,0.2};//err
// 因为是初始化列表，不允许损失精度的转换。
// 参见第二章。
```
# 3.5.3 指针和数组
```c++
int a[4]{};
int *p = a + 3;
p[-1] = 1;//指a[2]
for (auto& m : a)
    cout << m << " "
// 0 0 1 0
```
数组可以用 范围for 遍历， 可以用begin(a)、end(a)得到类似迭代器的指针。
内置数组类型的下标可以为负。但stl的类型都规定下表类型为无符号的类型了。


# 4.2 算数运算符
求余的符号：(c++11)
```c++
21 % 6; // 3
21 % -6; // 3
-21 % 6; // -3
-21 % -6; // -3
```
# 4.11.1 算术转换
整型提升：
* 可以存储到int的类型，提升为int、否则提升为unsigned int
* 较大的类型提升成 int、 unsigned int、unsigned long、 long long、 unsigned long long中可以容纳变量的类型中的最小的类型。
* 移位、取反等也会提升的。

```c++
int a=2;
a==true;// true被提升为int(1)，结果为false。
```

# 4.11.3 显式转换
```c++
//cast-name<type>(expression)
static_cast<int>(9.2);// 常用
dynamic_cast<...>(...);// 处理有多态的类，有运行时类型检查
const_cast<...>(...);// 可以且仅可转换底层const
reinterpret_cast<...>(...);// 用起来很危险
```
旧式的强制类型转换方法不能区分具体行为，不易检查，且用起来可能会很危险。
dynamic_cast在以后类的继承部分会详细讲。

# 5.6.3 标准异常
```
<stdexcept>中的异常类型
exception 最常见的问题，基类
runtime_error 运行时出现的问题
range_error 运行时错误： 生成的结果超出了有意义的值域范围
overflow_error 运行时错误： 计算上溢
underflow_error 运行时错误： 计算下溢
logic_error 程序逻辑错误
domain_error 逻辑错误：参数对应的结果值不存在
invalid_error 逻辑错误：无效参数
length_error 逻辑错误：试图创建一个超出该类型最大长度的对象
out_of_range 逻辑错误：使用一个超出有效范围的值
```
如下两种定义在其它文件
* bad_alloc (new)
* bad_cast (type_info)
  
```c++
try
{
...
}
catch(exception& e)
{
...
throw;//再次丢出 not-handled
}
```
可以为函数表明会抛出何种异常
```c++
void func() throw() {} //不抛出任何类型的异常
void func() noexcept {} // 同上
void func() throw(...) {} //可抛出任何类型的异常
void func() throw(Ty1, Ty2) //可抛出两种类型的异常
// 可抛出某种异常表示不一定会抛出异常，但如果抛出一定会是给定的类型

// 看起来大概仅限func内直接的throw，func内调用的函数throw了的话不算。
```