#include <string>
using namespace std;


class StrVec
{
public:
	//default
	StrVec() :
		elements(nullptr), first_free(nullptr), cap(nullptr) {}
	//copy control
	StrVec(const StrVec& rhs)
	{
		auto data = alloc_n_copy(rhs.begin(), rhs.end());
		elements = data.first;
		cap = first_free = data.second;
	}
	StrVec& operator=(const StrVec& rhs)
	{
		auto data = alloc_n_copy(rhs.begin(), rhs.end());
		free();
		elements = data.first; 
		cap = first_free = data.second;
		return *this;
	}
	~StrVec()
	{
		free();
	}

	// initialization
	explicit StrVec(int sz) :StrVec(sz, string()) {}
	explicit StrVec(int sz, string val)
	{
		auto data = alloc.allocate(sz);
		elements = data;
		for (int i = 0; i != sz; ++i)
		{
			alloc.construct(data++, val);
		}
		cap = first_free = data;
	}
	StrVec(const initializer_list<string>& in)
	{
		elements = alloc.allocate(in.size());
		cap = first_free = uninitialized_copy(in.begin(), in.end(), elements);
	}
	
	//utility
	void push_back(const std::string&);
	size_t size() const { return first_free - elements; }
	size_t capacity() const{ return cap - elements; }
	std::string *begin() const { return elements; }
	std::string *end() const { return first_free; }
	void reverse()
	{
		if (elements)
		{
			auto b = elements, e = first_free - 1;
			while (b < e)
			{
				swap(*b++, *e--);
			}
		}
	}

private:
	static std::allocator<std::string> alloc;
	void chk_n_alloc()
	{
		if (size() == capacity())
			reallocate();
	}

	std::pair<std::string*, std::string*> 
		alloc_n_copy(const string*, const string*);

	void free();
	void reallocate();

	string *elements, *first_free, *cap;
};

std::allocator<string> StrVec::alloc;

void StrVec::push_back(const std::string& rhs)
{
	chk_n_alloc();
	//内存是未构造的，需要进行构造
	alloc.construct(first_free++, rhs);
}

std::pair<std::string*, std::string*>
StrVec::alloc_n_copy(const string* begin, const string* end)
{
	auto data = alloc.allocate(end - begin);
	return { data, uninitialized_copy(begin, end, data) };
}

void StrVec::free()
{
	if (elements)
		for (auto p = first_free; p != elements;)
			alloc.destroy(--p);
	alloc.deallocate(elements, cap - elements);
}

void StrVec::reallocate()
{
	auto new_capacity = size() ? 2 * size() : 1;
	auto new_data = alloc.allocate(new_capacity);
	
	auto dest = new_data;
	auto src = elements;
	for (size_t i = 0; i != size(); ++i)
	{
		alloc.construct(dest++, std::move(*src++));
	}
	free();
	elements = new_data;
	cap = new_data + new_capacity;
	first_free = dest;
}

int main()
{
	StrVec empty;
	StrVec test(3, "test");
	StrVec test2{ "test1","test2","test3" };
	StrVec test3 = test;
	test2.push_back("test4");
	test2.push_back("test5");
	test2.reverse();
	empty.reverse();
	return 0;
}