#include <iostream>
#include <string>
#include <algorithm>
#include <memory>
#include <iterator>
#include <vector>
#include <map>
#include <numeric>
#include <functional>
using namespace std;

//// impl
//template<typename Ty>
//Ty* Get(const std::string&);
// 但这个返回值显然无法实现

class ProxyBase
{
public:
	virtual void Run() = 0 {}
	virtual size_t GetSize() = 0 { return 0; };
	virtual void* ForceGetPtr() = 0 { return nullptr; };
	virtual ~ProxyBase() {}
};

template<typename Ty>
class Proxy : public ProxyBase
{
public:
	typedef Ty value_type;
	shared_ptr<Ty> ptr;

	Proxy(const Proxy&) = default;
	Proxy(Proxy&&) = default;

	Proxy(shared_ptr<Ty>& rhs) : ptr(rhs) {}
	Proxy(shared_ptr<Ty>&& rhs) : ptr(std::move(rhs)) {}

	void Run()
	{
		InstalledFunc(*ptr);
		//cout << typeid(*ptr.get()).name() << endl;
	}

	size_t GetSize()
	{
		return value_size;
	}

	void* ForceGetPtr() 
	{
		return ptr.get(); 
	};

public:
	const static size_t value_size = sizeof(Ty);

	static void(*InstalledFunc)(Ty&);

	static void InstallFunc(void(*f)(Ty&))
	{
		InstalledFunc = f;
	}
};

//template<typename Ty>
//const size_t Factory<Ty>::sz = sizeof(Ty);

template<typename Ty>
void(*Proxy<Ty>::InstalledFunc)(Ty&);

template<typename Ty>
class Factory
{
public:
	static ProxyBase* Get()
	{
		return new Proxy<Ty>(make_shared<Ty>());
	}

	static bool Register(const string& key)
	{
		if (FactorySearch::Table.count(key) == 0)
		{
			FactorySearch::Table[key] = 
				Factory<Ty>::Get;
			return true;
		}
		else
			return false;
	}
};

class FactorySearch
{
public:
	typedef ProxyBase* (*ftype)();
	static map<string, ftype> Table;

	// 每次都会创建一个新的
	static shared_ptr<ProxyBase> Get(const string& key)
	{
		if (Table.count(key) == 0)
			return nullptr;
		else
		{
			shared_ptr<ProxyBase> Ptr(Table[key]());
			return Ptr;
		}
	}
};

map<string, FactorySearch::ftype> FactorySearch::Table;

// 使用示例
void InitTable()
{
	Factory<vector<int>>::Register("vint");
	Proxy<vector<int>>::InstallFunc
	(
		[](vector<int>& which)
	{
		which.resize(10);
		iota(which.begin(), which.end(), 1);
		random_shuffle(which.begin(), which.end());
		for_each(which.begin(), which.end(), [](int t) {cout << t << ends; });
		cout << endl;
		sort(which.begin(), which.end());
		for_each(which.begin(), which.end(), [](int t) {cout << t << ends; });
		cout << endl;
	}
	);
}

int main()
{
	InitTable();
	auto t = FactorySearch::Get("vint");
	cout << t->GetSize() << endl;
	t->Run();

	return 0;
}