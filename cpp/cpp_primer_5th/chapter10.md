注： 以下一些为书上的摘抄，记录仅供参考，不太敢保证完全正确。

# 泛型算法

## 概述

一般在 algorithm 和 numeric 中。

算法操作的是迭代器,不会修改容器的大小。

# 10.2.1 只读算法

要想真正的只读，传递const的begin和end。但如果有修改值的需求，还是需要用普通的begin和end。

```c++
// #1 find
it = find(begin,end,val);//指向第一个结果的迭代器或end

// #2 count
times = count(begin,end,val);//返回出现次数，类型为iterator::difference_type

// #3 accumulate
sum = accumulate(begin,end,offset);//返回范围内和+offset的值，类型同数据

// #4 equal
bool isequal = euqal(begin,end,begin);
//长度上一般假设 第二个序列 >= 第一个序列

// ...还有很多，此处仅列出书上的内容，以后有机会再整理

```

# 10.2.2 写容器元素的算法

```c++
// #1 fill  fill_n
void fill(begin,end,val);
it = fill_n(begin,len,val);//返回填充后对应的end迭代器

// #2 copy
it = copy(begin,end,obegin);//返回obegin对应的end位置迭代器

// #3 replace  replace_copy
void replace(begin,end,srcVal,dstVal);//将src替换为dst
it = replace_copy(begin,end,obegin,srcVal,dstVal);//并保存到新的数组里，返回obegin对应的end位置迭代器

// #4 iota
void iota(begin,end,val);// 将内容填充为val、val+1、val+2、...
//例如：
vector<int> v(5);
iota(begin(v),end(v),0);//v为{0,1,2,3,4}
```

back_inserter可以插入元素：
```c++
vector<int> vec;
auto it = back_inserter(vec);
*it = 42;//此时vec中有一个元素42
//或者这样：
vector<int> seq;
fill_n(back_inserter(seq), 10, 0);//添加10个0进去
```
泛型算法确实不会直接修改空间，修改空间在这里是由back_inserter处理的。对于算法来说，迭代器的使用方式完全一致。


# 10.2.3 重排容器元素的算法

```c++
// #1 sort  stable_sort
void sort(begin,end);//不用多说，默认升序
void stable_sort(begin,end);

// #2 unique
it = unique(begin,end);//在已排好序的数组上进行处理，返回新的尾部iterator

// 例子
vector<int> nums{...};
sort(nums.begin(),nums.end());
auto it = unique(nums.begin(),nums.end());
nums.erase(it,vec.end());

// #3 reverse
void reverse(begin,end);//反转

// 关于swap
void swap(a,b);//交换a,b的值
void iter_swap(it1,it2);//交换it指向的值，但不交换it
```

# 10.3.1 向算法传递函数
English|Chinese|note
--|--|--
unary predicate | 一元谓词 | 有一个参数
binary predicate | 二元谓词 | 有两个参数

```c++
// #1 sort接受二元谓词
void sort(begin,end,bpred);

// 真的就传函数
vector<A> vec{...};
bool isShorter(const A&,const A&);//定义不写了
sort(vec.begin(),vec.end(),isShorter);

// 传个functor (14.8节会讲大概)
struct Cmp
{
    bool operator()(const A&l, const A&r)
	{
		return l.id > r.id;
	}
};
sort(vec.begin(), vec.end(), C());

// 传个lambda
[capture_list](parameter_list) mutable -> return_type {function_body}
[capture_list]{function_body};//最小写法
//返回值如果不能够推断类型，则返回void

auto f = []{return 42;};
//  f() == 42; // true!

sort(vec.begin(), vec.end(), 
    [](const A&l, const A&r)
    {
        return l.id > r.id;
    });
```

# 10.3.3 lambda 捕获和返回
接上节，lambda捕获列表：
```c++
int val,res;
按值捕获    [val]{return ++val;}
按引用捕获  [&val]{return ++val;}
隐式捕获    [=]{...}//推断要用的变量并用值捕获
隐式+显式   [&, val]{...}// res为引用捕获，val为值捕获
```
引用捕获需要保证引用的变量在使用lambda时是存在的。

mutable出现的话，值捕获的变量值为可修改的，引用捕获的值需要看底层const。
```c++
int val = 0, res = 1;
auto f = [val] () {return val++; };//error
auto f = [val] ()mutable {return val++; };//okay
auto f = [&val] () {return val++; };//okay

[]()->int{return 0;}//指出返回值类型
```
mutable需要和参数列表括号一起使用。

# 10.3.4 参数绑定
假如有一个函数
bool check(const A&, int sz);

而某个算法需要一元谓词 bool func(const A&);

可以通过绑定bind来调整函数参数。bind位于functional头文件中。
```c++
//形式
auto new_callable = bind(callable, arg_list);
// auto g = bind(f, a, b, _2, c, _1);
// g(_1, _2); 类似于 f(a, b, _2, c, _1);

auto func = bind(check, placeholders::_1, 6);
// func 为 bool(const A&); 类型的callable
// func(arg) 类似于调用了 check(arg, 6);
```

bind实际上将给定的参数拷贝到返回的func中，所以想传递引用时，并不能直接传过去。需要使用std::ref(val)或cref进行传递。

例如：

```c++
ostream& print(ostream& os, const string& s);
//此处的ostream不支持复制

auto f = bind(print, ref(os), _1);
//此时传递了引用
```

# 支持谓词的算法
```c++
// #1 find_if  find_if_not
it = find_if(begin,end,upred);
it = find_if_not(begin,end,upred);
//bool pred(const Type &a);

// #2 count_if
iterator::difference_type count_if(begin,end,upred);
//bool pred(const Type &a); 

// #3 for_each
uFunc for_each(begin,end,uFunc);
// void fun(const Type &a);

//例如：
vector<int> vec{ ... };
struct Sum
{
    int sum = 0;
    void operator()(int Item) { sum += Item; }
};
auto res = for_each(vec.begin(), vec.end(), Sum());
// res.sum 为求和结果

// #4 replace_if
void replace_if(begin,end,upred,valNew);
// bool pred(const Type &a);
//替换upred结果为true的元素

// #5 transform
it = transform(begin,end,obegin,u_op);
// Ret u_op(const Type &a);
it = transform(begin,end,begin2,obegin,b_op);
// Ret fun(const Type1 &a, const Type2 &b); 
// 返回obegin写入后对应的oend迭代器

//例如：
vector<int> t{ 1,2,3,4,5,6 };
vector<int> t2{ 11,12,13,14,15,16 };
vector<int> o;
transform(t.cbegin(), t.cend(), t2.cbegin(), back_inserter(o), 
    [](const int&l, const int&r) {return r - l; });
// o内的结果为6个10

// #6 sort  stable_sort
void sort(begin,end,bPred);
//bool cmp(const Type1 &a, const Type2 &b); 
less<int>();//是一个functor，可以用于这里的bPred
greater<int>();//还有greater_equal等等

// #7 euqal
bool equal(begin1,end1,begin2);
bool equal(begin1,end1,begin2,bPred);
bool equal(begin1,end1,begin2,end2);
bool equal(begin1,end1,begin2,end2,bPred);
// bool pred(const Type1 &a, const Type2 &b);
// 相等返回true
// 如果提供了end2且两个长度不一致，返回false
```

# 10.4 再探迭代器

- 容器迭代器 iterator
- 插入迭代器 insert iterator
- 流迭代器   stream iterator
- 反向迭代器 reverse iterator
- 移动迭代器 move iterator (见13.6.2节)

# 10.4.1 插入迭代器

- back_inserter
- front_inserter
- inserter

back_inserter、front_inserter只有在容器支持对应成员函数的情况下才能使用。
```c++
vector<int> v{1,2,3,4};
auto it = v.begin() + 3;
auto it_insert = inserter(v,it);
*it_inserter = 5;
// 1 2 3 5 4
*it_inserter = 6;
// 1 2 3 5 6 4
list<int> v2;
copy(v.cbegin(),v.cend(),front_inserter(v2));
// 4 6 5 3 2 1
```

# 10.4.2 iostream迭代器

istream_iterator和ostream_iterator

## istream_iterator
支持：
- 通过istream初始化
- operator==  operator!=
- operator*  operator->  解引用
- operator++  前置和后置
```c++
istream_iterator<int> int_it(cin);//从cin输入读取int的iterator
istream_iterator<int> int_eof;//默认为eof的iterator
ifstream in("file.txt");
istream_iterator<string> str_it(in);//从文件流读取string的iterator
//读取cin输入的例子：
vector<int> vec;
while(int_it!=int_eof)
    vec.push_back(*int_it++);
//    或
vector<int> vec(int_it,int_eof);
//  这样会在文件尾或第一个不是int的位置停下。
//例子2：
cout << accumulate(int_it, int_eof, 0) << endl;
//对输入求和
```
在istream_iterator与一个流绑定后，标准库不保证立刻从迭代器读取数据，在第一次解引用迭代器之前，从流中读取数据的操作是保证已经完成了的。

## ostream_iterator

打印一个容器会方便许多，只需要将容器拷贝到ostream_iterator<T>(cout)中。

```c++
ostream_iterator<T> out(os);
ostream_iterator<T> out(os, d);//d为分隔符
out = val; //用<<将val输出到out对应的流中
*out,++out,out++;//运算符存在，不会对out做任何操作，且返回out
//例子：
ostream_iterator<int> out_iter(cout, " ");//空格分隔符
vector<int> vec{1,2,3,4,5};//数据
//打印方式1
for(auto&m:vec)
    *out_iter++ = m;
//打印方式2
copy(vec.begin(),vec.end(),out_iter);
//均打印 1 2 3 4 5
cout << endl;
```

## 自定义类型

假设自定义类型为A，如果支持operator>>则可以使用istream_iterator<A>；如果支持operator<<则可使用ostream_iterator<B>。

```c++
// istream的例子：
struct A { int val = 0; };
istream& operator>>(istream& is, A& in)
{//处理读取过程
	is >> in.val;
	return is;
}
int main()
{
	istream_iterator<A> t(cin);
    //从cin读取类型为A的数据
	vector<A> vec;
	copy_n(t, 5, back_inserter(vec));
    //最多读取5个
    //输入 1 3 5 7 end
    //vec: 1 3 5 7 0
	return 0;
}
```

```c++
// ostream的例子：
struct A 
{ 
    int val = 0; 
	A(int _val = 0) :val(_val) {}
};
ostream& operator<<(ostream& os, const A& in)
{//处理读取过程
	os << in.val;
	return os;
}
int main()
{
	ostream_iterator<A> t(cout, " ");
	vector<A> vec{ 1,2,3,4,5 };
	copy_n(vec.begin(), 5, t);
    //输出 1 2 3 4 5 
    //注意最后会有个空格的
	return 0;
}
```

如果要自定义初始化时的流，可能不是那么好做：
```c++
//一个可能不是很好的例子，最好做成functor使用generate算法赋值。
//ty需要为数值类型，Times为容量
template<typename ty, int Times>
struct RandomGenerator
{
private:
	stringstream stm;
	std::default_random_engine generator;
	std::uniform_real_distribution<ty> distribution;
public:
	typedef istream_iterator<ty> Generator;
	RandomGenerator(ty min = 0, ty max = 6) 
		:distribution(min, max)
	{
		unsigned timeNow = (chrono::system_clock::now().time_since_epoch() / std::chrono::milliseconds(1)) % 1000;
		generator.seed(timeNow);
		for(int i=0; i<Times;++i)
			stm << distribution(generator) << " ";
		stm << "#end";//为了能够中止
	}
	operator istream&()
	{
		return stm;//将构造好的流传给iterator
	}
};
int main()
{
	RandomGenerator<double, 5> test;
	istream_iterator<double> t(test);
    // test在创建后的内容就已经是固定的5个数字了。
	vector<double> vec;
	copy_n(t, 10, back_inserter(vec));
    // 结果为5个随机的数字，后面的则没有赋值。
	return 0;
}
// 如果可能的话，以后我会尝试改进它。
```

# 10.4.3 反向迭代器
```c++
vec.cbegin()--------->vec.cend()
    ↓                    ↓
  ┌──┬──┬──┬──┬──┬──┬──┐——
——└──┴──┴──┴──┴──┴──┴──┘
↑                    ↑
vec.crend()<--------vec.crbegin()
//例如：
vector<int> vec;
r_iter = vec.crbegin();
++r_iter;//实际为左移，需要容器支持递减操作
//再例如
string s{"first,middle,last"};
auto r_iter = find(s.crbegin(),s.crend(),',');
//it_ = r_iter.base();//返回普通迭代器
cout << string(r_iter.base(), s.cend());
// 如果直接用reverse_iterator打印，将会是tsal
// 所以需要转换为普通iterator来打印。(使用base)
```

# 10.5 泛型算法结构

算法要求的迭代器可分为5种
type|note
--|--
输入迭代器|只读不写；单次扫描，仅递增
输出迭代器|只写不读；单次扫描，仅递增
前向迭代器|可读写；多次扫描，仅递增
双向迭代器|可读写；多次扫描，可递增递减
随机访问迭代器|可读写，多次扫描，支持全部迭代器运算

## 输入迭代器

需要支持：
- operator== operator!=
- operator++ 前置和后置
- operator*  解引用，但仅用于赋值号右侧
- operator->

find、accumulate等要求输入迭代器。istream_iterator也是一种输入迭代器。

## 输出迭代器
- operator++ 前置和后置
- operator*  解引用，但仅用于赋值号左侧

一个输出迭代器只能被赋值一次。
copy的第三个参数要求输出迭代器。ostream_iterator也是一种输出迭代器。

## 前向迭代器
需要支持：
- 输入迭代器的操作
- 输出迭代器的操作
  
replace要求前向迭代器。

## 双向迭代器
需要支持：
- 支持前向迭代器的所有操作
- operator-- 前置和后置

reverse要求双向迭代器

## 随机访问迭代器
需要支持：
- 需要支持双向迭代器的所有操作
- operator<  operator<=  operator>  operator>=
- operator+=  operator-=  operator+  operator- 参数为iterator对一个整数。
- operator- 参数为两个iterator
- operator[] 下标运算符


# 10.5.3 算法命名规范

## 一些算法使用重载传入一个谓词
如 unique，sort等

## _if版本的算法用谓词替代元素值
如 find--find_if，count--count_if等

## 拷贝元素的版本和不拷贝的版本
_copy结尾的算法多传入一个dest迭代器(或区间)
如reverse--reverse_copy等

# 10.6 特定容器算法

list和forward_list两种数据结构，
```c++
lst.merge(lst2)     //要求两个序列都是有序的
lst.merge(lst2,comp)
lst.remove(val)     //删除相等的项，调用(erase)
lst.remove_if(upred)
lst.reverse()       //反转顺序
lst.sort()          //使用operator<排序
lst.sort(comp)
lst.unique()        //要求排好序，会调用erase删除同一个值的连续拷贝
lst.unique(bpred)

//splice将
lst.splice(args)
forward_lst.splice_after(args)
//args形式:
(p,lst2) 将lst2的所有元素移动到lst中p之前的位置
         lst2中的元素会被删除，lst2类型要和lst一样且lst2不能是lst本身。
         如果是flst，插入的是p之后的位置。
(p,lst2,p2) 将lst2中p2迭代器指向的元素移动到lst中。
            移动后p2对应元素被删除。
            如果是flst，插入的是p之后的位置，移动的是p2后的元素。
(p,lst2,b,e) 将lst2的b,e范围内元素从lst2移动到lst或flst。
             lst2可以与lst相同，但p不能在b,e区间内。
```
需要注意迭代器会发生变化。