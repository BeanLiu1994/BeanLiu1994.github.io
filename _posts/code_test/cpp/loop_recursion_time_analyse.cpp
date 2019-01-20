#include <string>
#include <vector>
#include <iostream>
#include <chrono>
using namespace std;

template<typename Display_ty = std::chrono::microseconds>
class Timer
{
public:
	Timer(bool startNow = true)
	{
		if (startNow) StartTimer();
	}
	inline void StartTimer()
	{
		start = std::chrono::steady_clock::now();	
	}
	inline long long EndTimer(const char _printThis[])
	{
		Display_ty duration = std::chrono::duration_cast<Display_ty>(std::chrono::steady_clock::now() - start);
		if(_printThis)
			cout << _printThis << " elapsed time:  " << duration.count() << std::endl;
		return duration.count();
	}
private:
	std::chrono::steady_clock::time_point start;
};

int f1(int n)
{
	if (n == 0)
		return 0;
	else
		return n + f1(n - 1);
}

int f2(int n)
{
	if (n == 0)
		return 0;
	return n + f2(n - 1);
}

int f3(int n)
{
	int res = 1;
	for (int i = 2; i <= n; ++i)
	{
		res += i;
	}
	return res;
}

int f4(int n, int res = 0)
{
	if (n == 0)
		return res;
	else
		return f4(n - 1, res + n);
}

int f5(int n)
{
	return n ? n + f5(n - 1) : 0;
}

template<int n>
struct f6
{
public:
	static const int res = n + f6<n - 1>::res;
};

template<>
struct f6<0>
{
public:
	static const int res = 0;
};


constexpr int f7(int n)
{
	return n ? n + f7(n - 1) : 0;
}

int main()
{
	constexpr int n = 500;
	int res;

	Timer<std::chrono::nanoseconds> t;
	cout << n << endl;
	
	t.StartTimer();
	res = f7(n);
	t.EndTimer("timer initialize???");

	t.StartTimer();
	res = f1(n);
	t.EndTimer("simple recursion 1 ");
	std::cout << res << endl;

	t.StartTimer();
	res = f2(n);
	t.EndTimer("simple recursion 2 ");
	std::cout << res << endl;

	t.StartTimer();
	res = f3(n);
	t.EndTimer("loop               ");
	std::cout << res << endl;

	t.StartTimer();
	res = f4(n);
	t.EndTimer("tail recursion     ");
	std::cout << res << endl;

	t.StartTimer();
	res = f5(n);
	t.EndTimer("simple recursion 3 ");
	std::cout << res << endl;

	t.StartTimer();
	res = f6<n>::res;
	t.EndTimer("template           ");
	std::cout << res << endl;

	t.StartTimer();
	constexpr int res_const = f7(n);
	t.EndTimer("constexpr          ");
	std::cout << res_const << endl;

	return 0;
}